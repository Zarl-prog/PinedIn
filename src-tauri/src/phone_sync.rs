//! One-shot receiver for the Android companion app.
//!
//! The whole flow is deliberately short-lived. The user clicks "Sync Phone", we
//! bind a listener on the LAN, show a QR code carrying our address plus a random
//! token, and wait. The phone POSTs its unsynced captures once. Then the listener
//! is dropped and the token forgotten — there is no pairing to store, nothing
//! running in the background, and no way to push to this machine again without
//! another deliberate click.
//!
//! Everything here is local-network only, consistent with Pinned's fully-local
//! positioning: no task text ever leaves the two devices.

use crate::db::DbHandle;
use crate::window;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::post,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tokio::sync::oneshot;

/// How long a pairing token stays valid. The plan calls for 60–120s; 90 is long
/// enough to unlock a phone and open the app, short enough that a QR code left on
/// screen — or photographed — is useless by the time anyone could reuse it.
const TOKEN_TTL_SECS: i64 = 90;

/// Port for the temporary listener. Fixed rather than ephemeral so the number in
/// the QR is predictable and easy to unblock in a firewall once.
const SYNC_PORT: u16 = 7391;

/// One task as the phone sends it. Mirrors the payload contract in the plan.
#[derive(Debug, Deserialize)]
pub struct IncomingTask {
    pub id: String,
    pub text: String,
    pub created_at: String,
    pub workspace: Option<String>,
}

/// What the frontend needs to draw the pairing screen.
#[derive(Debug, Clone, Serialize)]
pub struct PairingPayload {
    /// The JSON string actually encoded in the QR.
    pub encoded: String,
    /// Pre-rendered QR as an SVG string, ready to drop into the DOM.
    pub svg: String,
    pub host: String,
    pub port: u16,
    pub expires_at: String,
    pub expires_in_secs: i64,
}

/// The token for the sync currently in flight, if any.
struct Session {
    token: String,
    expires_at: chrono::DateTime<chrono::Utc>,
}

/// Live sync state. Registered in Tauri's state so the command handlers and the
/// axum route can both reach it.
#[derive(Default)]
pub struct PhoneSync {
    session: Mutex<Option<Session>>,
    /// True while a listener is bound, so a second "Sync Phone" click reuses it
    /// instead of failing to bind the same port.
    listening: AtomicBool,
    /// Fires when a batch lands, letting the listener shut itself down.
    done: Mutex<Option<oneshot::Sender<()>>>,
}

impl PhoneSync {
    /// Mint a fresh token, replacing any previous one. Replacing is the point:
    /// generating a new QR must invalidate the old one immediately.
    fn open_session(&self) -> Result<(String, chrono::DateTime<chrono::Utc>), String> {
        let token = random_token()?;
        let expires_at = chrono::Utc::now() + chrono::Duration::seconds(TOKEN_TTL_SECS);
        let mut guard = self
            .session
            .lock()
            .map_err(|_| "Sync state lock poisoned".to_string())?;
        *guard = Some(Session {
            token: token.clone(),
            expires_at,
        });
        Ok((token, expires_at))
    }

    /// Check a presented token and consume the session if it is good. Consuming
    /// on success is what makes a token single-use — a replayed POST finds
    /// nothing to match against.
    fn consume(&self, presented: &str) -> Result<(), TokenError> {
        let mut guard = self.session.lock().map_err(|_| TokenError::Rejected)?;
        let session = guard.as_ref().ok_or(TokenError::Rejected)?;

        if chrono::Utc::now() > session.expires_at {
            *guard = None;
            return Err(TokenError::Expired);
        }
        // Constant-time-ish compare. The token is single-use and short-lived on a
        // LAN, so this is belt-and-braces rather than load-bearing.
        if !constant_time_eq(session.token.as_bytes(), presented.as_bytes()) {
            return Err(TokenError::Rejected);
        }
        *guard = None;
        Ok(())
    }

    fn close_session(&self) {
        if let Ok(mut guard) = self.session.lock() {
            *guard = None;
        }
    }
}

enum TokenError {
    Expired,
    Rejected,
}

#[derive(Clone)]
struct SyncState {
    app: AppHandle,
    db: Arc<DbHandle>,
}

/// Build the pairing payload and make sure a listener is up to receive it.
///
/// Returns the QR contents plus a rendered SVG. Errors are strings so they can
/// surface straight into the Tauri command result.
pub fn begin(app: &AppHandle, db: Arc<DbHandle>) -> Result<PairingPayload, String> {
    let state = app.state::<Arc<PhoneSync>>().inner().clone();

    let host = local_ip()?;
    let (token, expires_at) = state.open_session()?;

    // `Z`-suffixed whole seconds, not the default `+00:00` form: the phone reads
    // this with `Instant.parse`, which only reliably accepts `Z` across Android
    // API levels. Getting this wrong makes every fresh code look expired.
    let expires_iso = expires_at.to_rfc3339_opts(chrono::SecondsFormat::Secs, true);

    let encoded = json!({
        "host": host,
        "port": SYNC_PORT,
        "token": token,
        "expires_at": expires_iso,
    })
    .to_string();

    let svg = render_qr_svg(&encoded)?;

    // Bind lazily: the first sync of the session starts the listener, later ones
    // reuse it. Nothing is listening until the user asks for a code.
    if !state.listening.swap(true, Ordering::SeqCst) {
        spawn_listener(app.clone(), db, state.clone());
    }

    Ok(PairingPayload {
        encoded,
        svg,
        host,
        port: SYNC_PORT,
        expires_at: expires_iso,
        expires_in_secs: TOKEN_TTL_SECS,
    })
}

/// Tear the pairing down early — the user closed the sync dialog without scanning.
pub fn cancel(app: &AppHandle) {
    let state = app.state::<Arc<PhoneSync>>();
    state.close_session();
    if let Ok(mut guard) = state.done.lock() {
        if let Some(tx) = guard.take() {
            let _ = tx.send(());
        }
    }
    let _ = state;
}

fn spawn_listener(app: AppHandle, db: Arc<DbHandle>, state: Arc<PhoneSync>) {
    let (tx, rx) = oneshot::channel::<()>();
    if let Ok(mut guard) = state.done.lock() {
        *guard = Some(tx);
    }

    tauri::async_runtime::spawn(async move {
        let router = Router::new()
            .route("/sync", post(receive))
            .with_state(SyncState {
                app: app.clone(),
                db,
            });

        // 0.0.0.0 so the phone can reach us across the LAN; the token is what
        // gates access, and it only exists for 90 seconds at a time.
        let addr = format!("0.0.0.0:{SYNC_PORT}");
        match tokio::net::TcpListener::bind(&addr).await {
            Ok(listener) => {
                let served = axum::serve(listener, router)
                    .with_graceful_shutdown(async move {
                        let _ = rx.await;
                    })
                    .await;
                if let Err(e) = served {
                    eprintln!("[phone-sync] Listener error: {e}");
                }
            }
            Err(e) => {
                eprintln!("[phone-sync] Failed to bind {addr}: {e}");
                let _ = app.emit(
                    "phone_sync_error",
                    format!("Couldn't open port {SYNC_PORT}: {e}"),
                );
            }
        }

        state.listening.store(false, Ordering::SeqCst);
        state.close_session();
    });
}

/// The one route. Validates the token, inserts, spawns cards, then asks the
/// listener to shut down — one scan is one sync.
async fn receive(
    State(state): State<SyncState>,
    headers: HeaderMap,
    Json(tasks): Json<Vec<IncomingTask>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let presented = headers
        .get("X-Pinned-Token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string();

    let sync = state.app.state::<Arc<PhoneSync>>().inner().clone();
    match sync.consume(&presented) {
        Ok(()) => {}
        // Both cases are 401 on the wire: the phone shows "that code has
        // expired — generate a new one" either way, and not distinguishing
        // them keeps this from being an oracle for guessing tokens.
        Err(TokenError::Expired) | Err(TokenError::Rejected) => {
            return Err(StatusCode::UNAUTHORIZED);
        }
    }

    // rusqlite is synchronous — do the inserts off the async runtime.
    let db = state.db.clone();
    let inserted = tokio::task::spawn_blocking(move || insert_batch(&db, &tasks))
        .await
        .map_err(|e| {
            eprintln!("[phone-sync] Insert task panicked: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .map_err(|e| {
            eprintln!("[phone-sync] Insert failed: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // Float a card for each new arrival, matching what happens when a task is
    // added on the desktop. Skipped duplicates get no card.
    if !inserted.is_empty() {
        window::open_all_task_cards(&state.app, &inserted);
    }
    let _ = state.app.emit("phone_sync_received", inserted.len());

    // One scan, one sync: release the listener now that the batch has landed.
    if let Ok(mut guard) = sync.done.lock() {
        if let Some(tx) = guard.take() {
            let _ = tx.send(());
        }
    }

    Ok(Json(json!({ "inserted": inserted.len() })))
}

/// Resolve each task's workspace and insert it. Already-seen `mobile_id`s are
/// skipped so a retried POST is harmless.
fn insert_batch(
    db: &DbHandle,
    tasks: &[IncomingTask],
) -> Result<Vec<crate::db::Task>, String> {
    let mut inserted = Vec::new();
    for task in tasks {
        if task.text.trim().is_empty() {
            continue;
        }
        // Keep the originating workspace when the laptop has one by that name;
        // otherwise the task lands unfiled, which is where desktop quick-adds go.
        let workspace_id = match task.workspace.as_deref() {
            Some(name) if !name.is_empty() && !name.eq_ignore_ascii_case("inbox") => {
                db.find_workspace_by_name(name)?
            }
            _ => None,
        };
        if let Some(created) =
            db.insert_synced_task(&task.id, task.text.trim(), &task.created_at, workspace_id)?
        {
            inserted.push(created);
        }
    }
    Ok(inserted)
}

fn render_qr_svg(contents: &str) -> Result<String, String> {
    use qrcode::render::svg;
    use qrcode::QrCode;

    let code = QrCode::new(contents.as_bytes())
        .map_err(|e| format!("Failed to build the pairing QR: {e}"))?;
    Ok(code
        .render::<svg::Color>()
        .min_dimensions(240, 240)
        .quiet_zone(true)
        .dark_color(svg::Color("#000000"))
        .light_color(svg::Color("#ffffff"))
        .build())
}

/// Our address on the LAN. This is what the phone dials, so a loopback address
/// is useless — better to fail loudly than hand out an unreachable QR.
fn local_ip() -> Result<String, String> {
    match local_ip_address::local_ip() {
        Ok(addr) if !addr.is_loopback() => Ok(addr.to_string()),
        Ok(_) => Err("This machine only has a loopback address — connect to WiFi first".into()),
        Err(e) => Err(format!("Couldn't determine this machine's WiFi address: {e}")),
    }
}

/// 32 hex chars from the OS CSPRNG.
fn random_token() -> Result<String, String> {
    let mut bytes = [0u8; 16];
    getrandom::getrandom(&mut bytes)
        .map_err(|e| format!("Failed to generate a pairing token: {e}"))?;
    Ok(bytes.iter().map(|b| format!("{b:02x}")).collect())
}

fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}
