use crate::db::{DbHandle, Task};
use crate::notifications;
use crate::window;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager, State, Window};
use tauri_plugin_autostart::ManagerExt;

pub static ZEN_MODE: AtomicBool = AtomicBool::new(false);
pub static COMPACT_MODE: AtomicBool = AtomicBool::new(false);
pub static EDGE_PEEK_ENABLED: AtomicBool = AtomicBool::new(false);
pub static EDGE_PEEK_EXPANDED: AtomicBool = AtomicBool::new(false);

static PENDING_SNOOZES: OnceLock<Mutex<HashSet<i64>>> = OnceLock::new();
pub fn pending_snoozes() -> &'static Mutex<HashSet<i64>> {
    PENDING_SNOOZES.get_or_init(|| Mutex::new(HashSet::new()))
}

pub fn emit_tasks_updated(app: &tauri::AppHandle, db: &DbHandle) {
    if let Ok(tasks) = db.get_all_tasks() {
        let _ = app.emit("tasks-updated", serde_json::json!({ "tasks": tasks }));
    }
    // Check edge_peek visibility based on incomplete tasks
    check_edge_peek_visibility(app, db);
}

fn check_edge_peek_visibility(app: &AppHandle, db: &DbHandle) {
    if !EDGE_PEEK_ENABLED.load(Ordering::SeqCst) {
        return;
    }
    if let Ok(tasks) = db.get_incomplete_tasks() {
        if tasks.is_empty() {
            // No incomplete tasks - schedule auto-hide. After a short grace
            // period, if still empty, close the window entirely and reset the
            // expanded state so it reopens as a collapsed pill next time.
            let app_clone = app.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(3));
                // Double-check tasks are still empty
                if let Some(db_state) = app_clone.try_state::<Arc<DbHandle>>() {
                    if let Ok(tasks) = db_state.get_incomplete_tasks() {
                        if tasks.is_empty() && EDGE_PEEK_ENABLED.load(Ordering::SeqCst) {
                            EDGE_PEEK_EXPANDED.store(false, Ordering::SeqCst);
                            let _ = db_state.update_setting("edge_peek_expanded", "false");
                            crate::window::close_edge_peek_window(&app_clone);
                        }
                    }
                }
            });
        } else {
            // Has incomplete tasks - ensure edge_peek is open (collapsed pill)
            if app.get_webview_window("edge_peek").is_none() {
                crate::window::open_edge_peek_window(app, false);
            }
        }
    }
}

#[tauri::command]
pub fn create_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    title: String,
    description: String,
    due_time: String,
    recurrence: Option<String>,
    tags: Option<String>,
    time_limit_minutes: Option<i64>,
    workspace_id: Option<i64>,
) -> Result<Task, String> {
    if title.trim().is_empty() {
        return Err("Task title cannot be empty".into());
    }
    let task = db.create_task_with_tags(
        &title,
        &description,
        &due_time,
        recurrence.as_deref(),
        tags.as_deref(),
        time_limit_minutes,
        workspace_id,
    )?;
    emit_tasks_updated(&app, &db);
    notifications::check_due_notifications(&app);

    // Check compact mode — open pill instead of individual card
    if get_compact_mode_state(&app) {
        crate::window::open_compact_pill_window(&app);
        return Ok(task);
    }

    // Check edge peek mode — don't open individual cards if edge peek is enabled
    if EDGE_PEEK_ENABLED.load(Ordering::SeqCst) {
        return Ok(task);
    }

    // Spawn window creation so we don't block the invoke response
    let task_clone = task.clone();
    let app_clone = app.clone();
    let db_clone = Arc::clone(&*db);
    std::thread::spawn(move || {
        // Re-check compact mode in case it changed during the thread spawn
        if get_compact_mode_state(&app_clone) {
            return;
        }
        let index = if task_clone.workspace_id.is_some() {
            db_clone
                .get_workspace_tasks(task_clone.workspace_id.unwrap())
                .ok()
                .and_then(|tasks| tasks.iter().position(|t| t.id == task_clone.id))
                .unwrap_or(0)
        } else {
            db_clone
                .get_incomplete_tasks()
                .ok()
                .and_then(|tasks| tasks.iter().position(|t| t.id == task_clone.id))
                .unwrap_or(0)
        };
        let _ = window::open_task_card(&app_clone, &task_clone, index);
    });

    Ok(task)
}

#[tauri::command]
pub fn quick_add_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    title: String,
    due_date: String,
) -> Result<(), String> {
    if title.trim().is_empty() {
        return Err("Task title cannot be empty".into());
    }
    let task = db.create_task(&title, "", &due_date)?;
    emit_tasks_updated(&app, &db);

    if let Some(task_id) = task.id {
        if let Ok(task) = db.get_task_by_id(task_id) {
            if get_compact_mode_state(&app) {
                crate::window::open_compact_pill_window(&app);
            } else if !EDGE_PEEK_ENABLED.load(Ordering::SeqCst) {
                let _ = window::open_task_card(&app, &task, 0);
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn get_all_tasks(db: State<'_, Arc<DbHandle>>) -> Result<Vec<Task>, String> {
    db.get_all_tasks()
}

#[tauri::command]
pub fn get_incomplete_tasks(db: State<'_, Arc<DbHandle>>) -> Result<Vec<Task>, String> {
    db.get_incomplete_tasks()
}

#[tauri::command]
pub fn get_task_by_id(db: State<'_, Arc<DbHandle>>, id: i64) -> Result<Task, String> {
    db.get_task_by_id(id)
}

#[tauri::command]
pub fn update_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
    title: String,
    description: String,
    due_time: String,
    recurrence: Option<String>,
    tags: Option<String>,
    time_limit_minutes: Option<i64>,
    started_at: Option<String>,
) -> Result<(), String> {
    db.update_task(
        id,
        &title,
        &description,
        &due_time,
        recurrence.as_deref(),
        tags.as_deref(),
        time_limit_minutes,
        started_at.as_deref(),
    )?;
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn close_task_card(app: tauri::AppHandle, task_id: i64) -> Result<(), String> {
    window::close_task_card(&app, task_id);
    Ok(())
}

#[tauri::command]
pub fn trigger_task_edit(app: AppHandle, id: i64) -> Result<(), String> {
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.show();
        let _ = main_window.unminimize();
        let _ = main_window.set_focus();
        let _ = app.emit("open_edit_task", id);
    }
    Ok(())
}

#[tauri::command]
pub fn delete_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<(), String> {
    db.delete_task(id)?;
    window::close_task_card(&app, id);
    window::restack_task_cards(&app);
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn complete_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<(), String> {
    // Check if task has recurrence before completing
    let task = db.get_task_by_id(id)?;

    if let Some(ref recurrence) = task.recurrence {
        // Advance the due date by the recurrence interval
        let new_due = advance_due_date(&task.due_time, recurrence);

        // Atomically create recurred task + mark original completed
        let new_task = db.complete_with_recurrence(
            id,
            &task.title,
            &task.description,
            &new_due,
            Some(recurrence.as_str()),
            task.tags.as_deref(),
            task.time_limit_minutes,
            task.workspace_id,
        )?;
        window::close_task_card(&app, id);

        // Open a new floating card for the recurred task
        let app_clone = app.clone();
        let db_clone = Arc::clone(&*db);
        let new_task_clone = new_task.clone();
        std::thread::spawn(move || {
            if crate::commands::get_compact_mode_state(&app_clone) {
                crate::window::open_compact_pill_window(&app_clone);
            } else if let Ok(tasks) = db_clone.get_incomplete_tasks() {
                let index = tasks
                    .iter()
                    .position(|t| t.id == new_task_clone.id)
                    .unwrap_or(0);
                let _ = window::open_task_card(&app_clone, &new_task_clone, index);
            }
        });

        emit_tasks_updated(&app, &db);
        return Ok(());
    }

    db.complete_task(id)?;
    window::close_task_card(&app, id);
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn uncomplete_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<(), String> {
    let task = db.get_task_by_id(id)?;
    if task.completed {
        db.uncomplete_task(id)?;

        // Open pill in compact mode, individual card otherwise
        if get_compact_mode_state(&app) {
            crate::window::open_compact_pill_window(&app);
        } else {
            // Find the task and its position among incomplete tasks, then open its card
            if let Ok(tasks) = db.get_incomplete_tasks() {
                let index = tasks.iter().position(|t| t.id == Some(id)).unwrap_or(0);
                let _ = window::open_task_card(&app, &task, index);
            }
            window::restack_task_cards(&app);
        }

        emit_tasks_updated(&app, &db);
        notifications::check_due_notifications(&app);
    }
    Ok(())
}

/// Returns `true` if compact mode is currently enabled.
/// Reads from the in-memory AtomicBool — safe to call from any thread
/// with no DB overhead and no TOCTOU race.
pub fn get_compact_mode_state(_app: &AppHandle) -> bool {
    COMPACT_MODE.load(Ordering::SeqCst)
}

/// Check if the current display mode is edge_peek by reading the DB.
/// Only call this from non-hot-path contexts (startup, settings changes).
pub fn get_display_mode_state(app: &AppHandle) -> String {
    let db = app.state::<Arc<DbHandle>>();
    db.get_setting("display_mode")
        .ok()
        .flatten()
        .unwrap_or_else(|| "normal".to_string())
}

/// Advance the due date by the given recurrence interval.
fn advance_due_date(current_date: &str, recurrence: &str) -> String {
    let base_date = chrono::NaiveDate::parse_from_str(current_date, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Utc::now().date_naive());

    let new_date = match recurrence {
        "daily" => base_date + chrono::Duration::days(1),
        "weekly" => base_date + chrono::Duration::days(7),
        "monthly" => base_date
            .checked_add_months(chrono::Months::new(1))
            .unwrap_or(base_date + chrono::Duration::days(30)),
        _ => {
            eprintln!("Unknown recurrence type: {recurrence}");
            return current_date.to_string();
        }
    };

    new_date.format("%Y-%m-%d").to_string()
}

#[tauri::command]
pub fn snooze_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<(), String> {
    // Guard: skip if a snooze thread is already pending for this task
    {
        let mut set = pending_snoozes().lock().map_err(|e| e.to_string())?;
        if !set.insert(id) {
            return Ok(());
        }
    }

    // Close the card window
    window::close_task_card(&app, id);

    // Spawn a thread to reopen the card after 30 minutes
    let app_clone = app.clone();
    let db_clone = Arc::clone(&*db);
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(30 * 60));

        // Re-fetch the task — snapshot may be stale after 30 min
        let task = match db_clone.get_task_by_id(id) {
            Ok(t) if !t.completed => t,
            _ => {
                if let Ok(mut set) = pending_snoozes().lock() {
                    set.remove(&id);
                }
                return;
            }
        };

        // Don't reopen a card if compact mode is active
        if crate::commands::get_compact_mode_state(&app_clone) {
            if let Ok(mut set) = pending_snoozes().lock() {
                set.remove(&id);
            }
            return;
        }

        // Find the task's position among incomplete tasks
        if let Ok(tasks) = db_clone.get_incomplete_tasks() {
            let index = tasks.iter().position(|t| t.id == Some(id)).unwrap_or(0);
            let _ = window::open_task_card(&app_clone, &task, index);
        } else {
            let _ = window::open_task_card(&app_clone, &task, 0);
        }
        window::restack_task_cards(&app_clone);

        if let Ok(mut set) = pending_snoozes().lock() {
            set.remove(&id);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn get_settings(db: State<'_, Arc<DbHandle>>) -> Result<AppSettings, String> {
    db.get_settings()
}

// ─── Autostart Commands ─────────────────────────────────────────────────────

#[tauri::command]
pub fn enable_autostart(app: AppHandle) -> Result<(), String> {
    app.autolaunch()
        .enable()
        .map_err(|e| format!("Failed to enable autostart: {e}"))?;

    // On Linux, patch the autostart .desktop file to add a 5-second
    // delay so PinedIn doesn't start before the desktop environment,
    // display server, and WebKitGTK are fully initialized. Without
    // this, systemd launches PinedIn too early and WebKit fails to
    // load the bundled frontend (appears as "unable to connect to
    // localhost" even though no localhost is involved).
    #[cfg(target_os = "linux")]
    {
        let autostart_dir = std::env::var("XDG_CONFIG_HOME")
            .ok()
            .map(|p| std::path::PathBuf::from(p).join("autostart"))
            .or_else(|| {
                std::env::var("HOME")
                    .ok()
                    .map(|h| std::path::PathBuf::from(h).join(".config").join("autostart"))
            });
        if let Some(dir) = autostart_dir {
            // Try multiple possible filenames — the autostart plugin uses
            // the app identifier (com.pinedin.desktop) or package name
            // (pinedin) depending on platform/version.
            let candidates = [
                format!("{}.desktop", app.package_info().name),
                format!("{}.desktop", app.package_info().crate_name),
                format!("{}.desktop", app.config().identifier.clone()),
            ];
            let desktop_file = candidates.iter().find_map(|name| {
                let path = dir.join(name);
                if path.exists() { Some(path) } else { None }
            });
            if let Some(ref desktop_file) = desktop_file {
                if let Ok(content) = std::fs::read_to_string(desktop_file) {
                    let mut lines: Vec<String> = content.lines().map(|l| l.to_string()).collect();

                    // Replace or add X-GNOME-Autostart-Delay
                    let delay_line = "X-GNOME-Autostart-Delay=5".to_string();
                    let delay_idx = lines.iter().position(|l| l.starts_with("X-GNOME-Autostart-Delay"));
                    match delay_idx {
                        Some(i) => lines[i] = delay_line,
                        None => lines.push(delay_line),
                    }

                    // Wrap Exec with a bash sleep so the delay applies on
                    // all Linux desktops, not just GNOME.
                    if let Some(exec_idx) = lines.iter().position(|l| l.starts_with("Exec=")) {
                        let exec = lines[exec_idx].replacen("Exec=", "", 1);
                        // Only wrap if not already wrapped
                        if !exec.starts_with("bash -c 'sleep") {
                            lines[exec_idx] = format!("Exec=bash -c 'sleep 5 && {}'", exec);
                        }
                    }

                    if let Err(e) = std::fs::write(desktop_file, lines.join("\n") + "\n") {
                        eprintln!("[autostart] Failed to patch desktop file: {e}");
                    }
                }
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub fn disable_autostart(app: AppHandle) -> Result<(), String> {
    app.autolaunch()
        .disable()
        .map_err(|e| format!("Failed to disable autostart: {e}"))
}

#[tauri::command]
pub fn is_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| format!("Failed to check autostart: {e}"))
}

// ─── Settings Commands ───────────────────────────────────────────────────────

use crate::db::AppSettings;

#[tauri::command]
pub fn update_setting(
    app: AppHandle,
    db: State<'_, Arc<DbHandle>>,
    key: String,
    value: String,
) -> Result<(), String> {
    db.update_setting(&key, &value)?;
    if key == "theme" {
        let _ = app.emit("theme_changed", &value);
    }
    if key == "compact_mode" {
        COMPACT_MODE.store(value == "true", Ordering::SeqCst);
    }
    Ok(())
}

#[tauri::command]
pub fn get_settings_map(db: State<'_, Arc<DbHandle>>) -> Result<std::collections::HashMap<String, String>, String> {
    db.get_settings_map()
}

#[tauri::command]
pub fn get_shake_interval(db: State<'_, Arc<DbHandle>>) -> Result<u64, String> {
    let map = db.get_settings_map()?;
    let value = map
        .get("shake_interval")
        .cloned()
        .unwrap_or_else(|| "30".to_string());
    value
        .parse::<u64>()
        .map_err(|e| format!("Invalid shake_interval: {e}"))
}

#[tauri::command]
pub fn set_shake_interval(
    app: AppHandle,
    db: State<'_, Arc<DbHandle>>,
    seconds: u64,
) -> Result<(), String> {
    db.update_setting("shake_interval", &seconds.to_string())?;
    let _ = app.emit("shake_interval_updated", seconds);
    Ok(())
}

#[tauri::command]
pub fn get_shake_enabled(db: State<'_, Arc<DbHandle>>) -> Result<bool, String> {
    let map = db.get_settings_map()?;
    let value = map
        .get("shake_enabled")
        .cloned()
        .unwrap_or_else(|| "true".to_string());
    Ok(value == "true")
}

#[tauri::command]
pub fn set_shake_enabled(
    app: AppHandle,
    db: State<'_, Arc<DbHandle>>,
    enabled: bool,
) -> Result<(), String> {
    db.update_setting("shake_enabled", if enabled { "true" } else { "false" })?;
    let _ = app.emit("shake_enabled_updated", enabled);
    Ok(())
}

// ─── Update Commands ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.request_restart();
    }
    Ok(())
}

// ─── Daily Digest Toggle ────────────────────────────────────────────────────

#[tauri::command]
pub fn get_daily_digest_enabled(db: State<'_, Arc<DbHandle>>) -> Result<bool, String> {
    let map = db.get_settings_map()?;
    Ok(map.get("daily_digest_enabled").map(|v| v == "true").unwrap_or(false))
}

#[tauri::command]
pub fn set_daily_digest_enabled(
    db: State<'_, Arc<DbHandle>>,
    enabled: bool,
) -> Result<(), String> {
    db.update_setting("daily_digest_enabled", if enabled { "true" } else { "false" })
}

#[tauri::command]
pub fn open_daily_digest_window(app: AppHandle) -> Result<(), String> {
    crate::window::open_daily_digest_window(&app);
    Ok(())
}

#[derive(serde::Serialize)]
pub struct DigestData {
    pub overdue: i64,
    pub due_today: i64,
    pub unfinished_yesterday: i64,
    pub total_active: i64,
}

#[tauri::command]
pub fn get_daily_digest(db: State<'_, Arc<DbHandle>>) -> Result<DigestData, String> {
    let today = chrono::Local::now().date_naive().to_string();
    let yesterday = (chrono::Local::now() - chrono::Duration::days(1))
        .date_naive()
        .to_string();

    let overdue = db.count_overdue_tasks(&today)?;
    let due_today = db.count_due_today(&today)?;
    let unfinished_yesterday = db.count_unfinished_from_date(&yesterday)?;
    let total_active = db.count_active_tasks()?;

    Ok(DigestData {
        overdue,
        due_today,
        unfinished_yesterday,
        total_active,
    })
}

// ─── Snap to Grid ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn snap_all_cards_to_grid(app: AppHandle) -> Result<(), String> {
    let windows = app.webview_windows();
    let mut task_windows: Vec<_> = windows
        .into_iter()
        .filter(|(label, _)| label.starts_with("task_"))
        .collect();

    task_windows.sort_by(|a, b| a.0.cmp(&b.0));

    let monitor = app
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;
    let screen_width = monitor.size().width as f64 / monitor.scale_factor();
    let screen_height = monitor.size().height as f64 / monitor.scale_factor();

    let card_width = crate::window::CARD_WIDTH;
    let card_height = crate::window::CARD_HEIGHT;
    let padding = 10.0;
    let x = screen_width - card_width - padding;
    let start_y = 80.0;

    for (i, (_, window)) in task_windows.iter().enumerate() {
        let y = start_y + (i as f64 * (card_height + padding));
        if y + card_height < screen_height {
            let _ = window.set_position(tauri::PhysicalPosition::new(
                (x * monitor.scale_factor()) as i32,
                (y * monitor.scale_factor()) as i32,
            ));
        }
    }
    Ok(())
}

// ─── Workspace Profiles ───────────────────────────────────────────────────────

#[tauri::command]
pub fn save_workspace(app: AppHandle, name: String) -> Result<i64, String> {
    let windows = app.webview_windows();
    let mut cards = vec![];

    for (label, window) in &windows {
        if label.starts_with("task_") {
            let task_id: i64 = label.replace("task_", "").parse().unwrap_or(0);
            if let Ok(pos) = window.outer_position() {
                cards.push(serde_json::json!({
                    "task_id": task_id,
                    "x": pos.x,
                    "y": pos.y
                }));
            }
        }
    }

    let state_json = serde_json::json!({ "cards": cards }).to_string();
    let db = app.state::<Arc<DbHandle>>();
    db.save_workspace(&name, &state_json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_workspaces(app: AppHandle) -> Result<Vec<crate::db::Workspace>, String> {
    let db = app.state::<Arc<DbHandle>>();
    db.get_all_workspaces().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_workspace(app: AppHandle, workspace_id: i64) -> Result<(), String> {
    let db = app.state::<Arc<DbHandle>>();
    let workspace = db.get_workspace_by_id(workspace_id).map_err(|e| e.to_string())?;
    let parsed: serde_json::Value =
        serde_json::from_str(&workspace.state_json).map_err(|e| e.to_string())?;

    let windows = app.webview_windows();
    for (label, window) in &windows {
        if label.starts_with("task_") {
            let _ = window.close();
        }
    }

    // Don't open individual cards in compact mode
    if !get_compact_mode_state(&app) {
        if let Some(cards) = parsed["cards"].as_array() {
            for card in cards {
                let task_id = card["task_id"].as_i64().unwrap_or(0);
                let x = card["x"].as_f64().unwrap_or(100.0);
                let y = card["y"].as_f64().unwrap_or(100.0);
                if let Ok(task) = db.get_task_by_id(task_id) {
                    crate::window::open_task_card_window_at(&app, &task, x, y);
                }
            }
        }
    }

    // Also activate the workspace so task list context matches
    let workspace_name = workspace.name.clone();
    db.update_setting("active_workspace_id", &workspace_id.to_string())?;
    let _ = app.emit("workspace_activated", serde_json::json!({ "name": workspace_name }));
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn delete_workspace(app: AppHandle, workspace_id: i64) -> Result<(), String> {
    let db = app.state::<Arc<DbHandle>>();

    // Was the workspace being deleted the currently active one?
    let was_active = matches!(
        db.get_setting("active_workspace_id"),
        Ok(Some(val)) if val == workspace_id.to_string()
    );

    db.delete_workspace(workspace_id).map_err(|e| e.to_string())?;

    if was_active {
        // Fall back to the global view so the UI isn't left filtering to a
        // workspace that no longer exists. Reuses the shared deactivate logic
        // (clears the setting, reopens global cards, emits workspace_deactivated).
        deactivate_workspace_inner(&app, &db)?;
    } else {
        emit_tasks_updated(&app, &db);
    }

    Ok(())
}

// ─── Edge Peek Commands ───────────────────────────────────────────────────────

/// Close any open task cards and reopen the normal floating cards for the
/// current view (active workspace if one is set, otherwise the global
/// incomplete tasks). Does nothing in compact mode, where the pill is the
/// display surface. Shared by compact-off and edge-peek-off so both restore
/// the same set of cards.
pub fn reopen_task_cards(app: &AppHandle, db: &DbHandle) {
    // In compact mode the pill is the display — don't spawn individual cards.
    if get_compact_mode_state(app) {
        return;
    }

    // Close whatever cards may already be open to avoid duplicates.
    let windows = app.webview_windows();
    for (label, window) in &windows {
        if label.starts_with("task_") {
            let _ = window.close();
        }
    }

    // Reopen for the active workspace if one is active, else global tasks.
    let active_ws = match db.get_setting("active_workspace_id") {
        Ok(Some(val)) if !val.is_empty() => val.parse::<i64>().ok(),
        _ => None,
    };
    let tasks = match active_ws {
        Some(id) => db.get_workspace_tasks(id),
        None => db.get_incomplete_tasks(),
    };
    if let Ok(tasks) = tasks {
        for (i, task) in tasks.iter().enumerate() {
            let _ = window::open_task_card(app, task, i);
        }
        window::restack_task_cards(app);
    }
}

#[tauri::command]
pub fn get_edge_peek_enabled(db: State<'_, Arc<DbHandle>>) -> Result<bool, String> {
    let map = db.get_settings_map()?;
    let value = map.get("edge_peek_enabled").cloned().unwrap_or_else(|| "false".to_string());
    Ok(value == "true")
}

#[tauri::command]
pub fn set_edge_peek_enabled(app: AppHandle, db: State<'_, Arc<DbHandle>>, enabled: bool) -> Result<(), String> {
    db.update_setting("edge_peek_enabled", if enabled { "true" } else { "false" })?;
    EDGE_PEEK_ENABLED.store(enabled, Ordering::SeqCst);

    if enabled {
        // Disable compact_mode when edge_peek is enabled (mutually exclusive)
        db.update_setting("compact_mode", "false")?;
        COMPACT_MODE.store(false, Ordering::SeqCst);
        crate::window::close_compact_pill_window(&app);

        // Close any open task cards — edge peek replaces them with the pill.
        let windows = app.webview_windows();
        for (label, window) in &windows {
            if label.starts_with("task_") {
                let _ = window.close();
            }
        }

        // Check if there are incomplete tasks before opening
        if let Ok(tasks) = db.get_incomplete_tasks() {
            if !tasks.is_empty() {
                crate::window::open_edge_peek_window(&app, false);
            }
        }
    } else {
        crate::window::close_edge_peek_window(&app);
        // Restore the normal floating task cards (mirrors compact-mode off).
        reopen_task_cards(&app, db.inner());
    }
    Ok(())
}

// Internal version that takes Arc directly (for shortcuts)
pub fn set_edge_peek_enabled_internal(app: AppHandle, db: Arc<DbHandle>, enabled: bool) -> Result<(), String> {
    db.update_setting("edge_peek_enabled", if enabled { "true" } else { "false" })?;
    EDGE_PEEK_ENABLED.store(enabled, Ordering::SeqCst);

    if enabled {
        // Close any open task cards — edge peek replaces them with the pill.
        let windows = app.webview_windows();
        for (label, window) in &windows {
            if label.starts_with("task_") {
                let _ = window.close();
            }
        }
        if let Ok(tasks) = db.get_incomplete_tasks() {
            if !tasks.is_empty() {
                crate::window::open_edge_peek_window(&app, false);
            }
        }
    } else {
        crate::window::close_edge_peek_window(&app);
        // Restore the normal floating task cards.
        reopen_task_cards(&app, &db);
    }
    Ok(())
}

#[tauri::command]
pub fn toggle_edge_peek(app: AppHandle, db: State<'_, Arc<DbHandle>>) -> Result<(), String> {
    let current = get_edge_peek_enabled(db.clone())?;
    set_edge_peek_enabled(app, db, !current)
}

// Toggle edge_peek from global shortcut (only needs AppHandle)
pub fn toggle_edge_peek_from_shortcut(app: &AppHandle) {
    if let Some(db) = app.try_state::<Arc<DbHandle>>() {
        let map = match db.get_settings_map() {
            Ok(m) => m,
            Err(_) => return,
        };
        let current = map.get("edge_peek_enabled").map(|v| v == "true").unwrap_or(false);
        let _ = set_edge_peek_enabled_internal(app.clone(), db.inner().clone(), !current);
    }
}

#[tauri::command]
pub fn expand_edge_peek(app: AppHandle) -> Result<(), String> {
    EDGE_PEEK_EXPANDED.store(true, Ordering::SeqCst);
    crate::window::expand_edge_peek(&app);
    // Persist expanded state
    if let Some(db) = app.try_state::<Arc<DbHandle>>() {
        let _ = db.update_setting("edge_peek_expanded", "true");
    }
    Ok(())
}

#[tauri::command]
pub fn collapse_edge_peek(app: AppHandle) -> Result<(), String> {
    EDGE_PEEK_EXPANDED.store(false, Ordering::SeqCst);
    crate::window::collapse_edge_peek(&app);
    // Persist collapsed state
    if let Some(db) = app.try_state::<Arc<DbHandle>>() {
        let _ = db.update_setting("edge_peek_expanded", "false");
    }
    Ok(())
}

#[tauri::command]
pub fn get_edge_peek_expanded(db: State<'_, Arc<DbHandle>>) -> Result<bool, String> {
    let map = db.get_settings_map()?;
    let value = map.get("edge_peek_expanded").cloned().unwrap_or_else(|| "false".to_string());
    Ok(value == "true")
}

// ─── Compact Mode ──────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_compact_mode(db: State<'_, Arc<DbHandle>>) -> Result<bool, String> {
    let map = db.get_settings_map()?;
    let value = map.get("compact_mode").cloned().unwrap_or_else(|| "false".to_string());
    Ok(value == "true")
}

#[tauri::command]
pub fn set_compact_mode(app: AppHandle, db: State<'_, Arc<DbHandle>>, enabled: bool) -> Result<(), String> {
    db.update_setting("compact_mode", if enabled { "true" } else { "false" })?;
    COMPACT_MODE.store(enabled, Ordering::SeqCst);

    if enabled {
        // Disable edge_peek when compact_mode is enabled (mutually exclusive)
        db.update_setting("edge_peek_enabled", "false")?;
        EDGE_PEEK_ENABLED.store(false, Ordering::SeqCst);
        crate::window::close_edge_peek_window(&app);

        // Close open task cards
        let windows = app.webview_windows();
        for (label, window) in &windows {
            if label.starts_with("task_") {
                let _ = window.close();
            }
        }
        // Hide main window so only the pill remains visible
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.hide();
        }
        crate::window::open_compact_pill_window(&app);
        let _ = app.emit("compact_mode_enabled", ());
    } else {
        crate::window::close_compact_pill_window(&app);
        // Restore main window
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.show();
            let _ = main.unminimize();
        }
        let db = db.inner();
        if let Ok(tasks) = db.get_all_active_tasks() {
            for (i, task) in tasks.iter().enumerate() {
                let _ = crate::window::open_task_card(&app, task, i);
            }
            crate::window::restack_task_cards(&app);
        }
        let _ = app.emit("compact_mode_disabled", ());
    }
    Ok(())
}

// ─── Zen Mode ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn set_zen_mode(app: AppHandle, hidden: bool) -> Result<(), String> {
    let windows = app.webview_windows();
    for (label, window) in windows {
        if label.starts_with("task_") {
            if hidden {
                let _ = window.hide();
            } else {
                let _ = window.show();
            }
        }
    }
    ZEN_MODE.store(hidden, Ordering::SeqCst);
    Ok(())
}

// ─── Time Limit Notifications ────────────────────────────────────────────────

#[tauri::command]
pub fn fire_time_limit_notification(
    app: AppHandle,
    _task_id: i64,
    task_title: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title("Time's up — PinedIn")
        .body(format!("Time limit reached for: {}", task_title))
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Pre-Scheduled Tasks ────────────────────────────────────────────────────

#[tauri::command]
pub fn add_presceduled_task(
    app: AppHandle,
    db: State<'_, Arc<DbHandle>>,
    title: String,
    body: String,
    scheduled_at: String,
    due_date: Option<String>,
    time_limit_minutes: Option<i64>,
    tags: Option<String>,
    workspace_id: Option<i64>,
) -> Result<i64, String> {
    if title.trim().is_empty() {
        return Err("Task title cannot be empty".into());
    }
    // Validate scheduled_at is not in the past — parse as RFC 3339/ISO
    // datetime so the comparison is timezone-aware and correct.
    let scheduled_dt = chrono::DateTime::parse_from_rfc3339(&scheduled_at)
        .map_err(|e| format!("Invalid scheduled_at format: {e}"))?;
    if scheduled_dt <= chrono::Utc::now() {
        return Err("scheduled_at must be in the future".to_string());
    }
    let id = db.create_presceduled_task(
        &title,
        &body,
        &scheduled_at,
        due_date.as_deref().unwrap_or(""),
        time_limit_minutes,
        tags.as_deref(),
        workspace_id,
    )?;
    emit_tasks_updated(&app, &db);
    Ok(id)
}

#[tauri::command]
pub fn get_presceduled_tasks(db: State<'_, Arc<DbHandle>>) -> Result<Vec<Task>, String> {
    db.get_presceduled_tasks()
}

#[tauri::command]
pub fn get_workspace_tasks(db: State<'_, Arc<DbHandle>>, workspace_id: i64) -> Result<Vec<Task>, String> {
    db.get_workspace_tasks(workspace_id)
}

#[tauri::command]
pub fn get_all_workspace_tasks(db: State<'_, Arc<DbHandle>>, workspace_id: i64) -> Result<Vec<Task>, String> {
    db.get_all_workspace_tasks(workspace_id)
}

/// Core logic for activating a workspace: persist the active id, close all
/// task cards, reopen the workspace's cards (unless compact), and emit the
/// events the frontend listens for. Shared by the Tauri command and the MCP
/// handler so both entry points behave identically.
pub fn activate_workspace_inner(app: &AppHandle, db: &DbHandle, workspace_id: i64) -> Result<(), String> {
    let workspace = db.get_workspace_by_id(workspace_id)?;
    let workspace_name = workspace.name.clone();
    db.update_setting("active_workspace_id", &workspace_id.to_string())?;

    let windows = app.webview_windows();
    for (label, window) in &windows {
        if label.starts_with("task_") {
            let _ = window.close();
        }
    }

    // Don't open individual cards in compact mode
    if !get_compact_mode_state(app) {
        let tasks = db.get_workspace_tasks(workspace_id)?;
        for (i, task) in tasks.iter().enumerate() {
            let _ = window::open_task_card(app, task, i);
        }
        window::restack_task_cards(app);
    }

    let _ = app.emit("workspace_activated", serde_json::json!({ "name": workspace_name }));
    emit_tasks_updated(app, db);
    Ok(())
}

/// Core logic for deactivating the active workspace: clear the active id,
/// close task cards, reopen global incomplete cards (unless compact), and
/// emit `workspace_deactivated`. Shared by the Tauri command and MCP handler.
pub fn deactivate_workspace_inner(app: &AppHandle, db: &DbHandle) -> Result<(), String> {
    db.update_setting("active_workspace_id", "")?;

    let windows = app.webview_windows();
    for (label, window) in &windows {
        if label.starts_with("task_") {
            let _ = window.close();
        }
    }

    // Don't open individual cards in compact mode
    if !get_compact_mode_state(app) {
        if let Ok(tasks) = db.get_incomplete_tasks() {
            for (i, task) in tasks.iter().enumerate() {
                let _ = window::open_task_card(app, task, i);
            }
            window::restack_task_cards(app);
        }
    }

    let _ = app.emit("workspace_deactivated", ());
    emit_tasks_updated(app, db);
    Ok(())
}

#[tauri::command]
pub fn activate_workspace(app: AppHandle, db: State<'_, Arc<DbHandle>>, workspace_id: i64) -> Result<(), String> {
    activate_workspace_inner(&app, &db, workspace_id)
}

#[tauri::command]
pub fn deactivate_workspace(app: AppHandle, db: State<'_, Arc<DbHandle>>) -> Result<(), String> {
    deactivate_workspace_inner(&app, &db)
}

#[tauri::command]
pub fn get_active_workspace_id(db: State<'_, Arc<DbHandle>>) -> Result<Option<i64>, String> {
    let map = db.get_settings_map()?;
    match map.get("active_workspace_id") {
        Some(val) if !val.is_empty() => {
            val.parse::<i64>().map(Some).map_err(|e| format!("Invalid active_workspace_id: {e}"))
        }
        _ => Ok(None),
    }
}

#[tauri::command]
pub fn add_task_to_workspace(app: AppHandle, db: State<'_, Arc<DbHandle>>, task_id: i64, workspace_id: i64) -> Result<(), String> {
    db.set_task_workspace(task_id, Some(workspace_id))?;
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn get_card_position(app: AppHandle, task_id: i64) -> Result<serde_json::Value, String> {
    let mut windows: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|k| k.starts_with("task_"))
        .cloned()
        .collect();
    windows.sort_by(|a, b| {
        let a_id = a.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        let b_id = b.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        a_id.cmp(&b_id)
    });

    let current_label = format!("task_{}", task_id);
    let index = windows.iter().position(|l| l == &current_label).unwrap_or(0);
    let total = windows.len();

    Ok(serde_json::json!({ "index": index, "total": total }))
}

#[tauri::command]
pub fn focus_next_card(app: AppHandle, task_id: i64) -> Result<(), String> {
    let mut windows: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|k| k.starts_with("task_"))
        .cloned()
        .collect();
    windows.sort_by(|a, b| {
        let a_id = a.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        let b_id = b.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        a_id.cmp(&b_id)
    });

    let current_label = format!("task_{}", task_id);
    let current_index = windows.iter().position(|l| l == &current_label).unwrap_or(0);
    if windows.is_empty() {
        return Ok(());
    }
    let next_index = (current_index + 1) % windows.len();
    let next_label = &windows[next_index];

    if let Some(window) = app.get_webview_window(next_label) {
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn focus_prev_card(app: AppHandle, task_id: i64) -> Result<(), String> {
    let mut windows: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|k| k.starts_with("task_"))
        .cloned()
        .collect();
    windows.sort_by(|a, b| {
        let a_id = a.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        let b_id = b.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        a_id.cmp(&b_id)
    });

    let current_label = format!("task_{}", task_id);
    let current_index = windows.iter().position(|l| l == &current_label).unwrap_or(0);
    if windows.is_empty() {
        return Ok(());
    }
    let prev_index = if current_index == 0 {
        windows.len() - 1
    } else {
        current_index - 1
    };
    let prev_label = &windows[prev_index];

    if let Some(window) = app.get_webview_window(prev_label) {
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn reassert_window_properties(window: Window) -> Result<(), String> {
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let _ = window.set_always_on_top(true);
    let _ = window.set_skip_taskbar(true);
    Ok(())
}

#[tauri::command]
pub fn complete_onboarding(app: AppHandle) -> Result<(), String> {
    let state = app.state::<Arc<DbHandle>>();
    state.update_setting("onboarding_completed", "true")
        .map_err(|e| e.to_string())
}
