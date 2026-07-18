use crate::commands::ZEN_MODE;
use crate::db::Task;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};

pub const CARD_WIDTH: f64 = 308.0;
pub const CARD_HEIGHT: f64 = 120.0;
const TOP_MARGIN: f64 = 80.0;
const RIGHT_MARGIN: f64 = 24.0;
const CARD_GAP: f64 = 12.0;

#[cfg(target_os = "linux")]
fn build_with_retry<F>(build_fn: F, max_retries: u32) -> Result<tauri::WebviewWindow, tauri::Error>
where
    F: Fn() -> Result<tauri::WebviewWindow, tauri::Error>,
{
    let mut last_error = None;
    for attempt in 0..max_retries {
        match build_fn() {
            Ok(window) => return Ok(window),
            Err(e) => {
                eprintln!("Window creation attempt {} failed: {}", attempt + 1, e);
                last_error = Some(e);
                if attempt + 1 < max_retries {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                }
            }
        }
    }
    Err(last_error.unwrap())
}

fn monitor_size(app: &AppHandle) -> (f64, f64) {
    if let Some(monitor) = app.primary_monitor().ok().flatten().or_else(|| {
        app.available_monitors()
            .ok()
            .and_then(|m| m.into_iter().next())
    }) {
        let scale = monitor.scale_factor();
        let size = monitor.size();
        return (size.width as f64 / scale, size.height as f64 / scale);
    }
    (1920.0, 1080.0)
}

/// Sum the height of all currently-open task card windows.
fn stack_offset_y(app: &AppHandle) -> f64 {
    let mut max_bottom = TOP_MARGIN;
    let windows = app.webview_windows();
    for (label, window) in windows.iter() {
        if !label.starts_with("task_") {
            continue;
        }
        if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
            let scale = window.scale_factor().unwrap_or(1.0);
            let logical_y = pos.y as f64 / scale;
            let logical_h = size.height as f64 / scale;
            let bottom = logical_y + logical_h;
            if bottom > max_bottom {
                max_bottom = bottom;
            }
        }
    }
    max_bottom
}

/// Create a small always-on-top window for a single task card.
/// Windows are stacked vertically starting from the top-right of the
/// primary monitor, beneath any cards that are already open.
pub fn open_task_card(app: &AppHandle, task: &Task, _index: usize) -> Result<(), String> {
    let id = match task.id {
        Some(id) => id,
        None => return Err("Task has no ID".into()),
    };

    let label = format!("task_{}", id);

    // Don't recreate if already exists
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }

    let (screen_w, _) = monitor_size(app);
    let x = (screen_w - CARD_WIDTH - RIGHT_MARGIN).max(0.0);
    let y = stack_offset_y(app) + CARD_GAP;

    let build_fn = || {
        let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("task-card.html".into()))
            .inner_size(CARD_WIDTH, CARD_HEIGHT)
            .resizable(false)
            .decorations(false);
        #[cfg(not(target_os = "macos"))]
        let builder = builder.transparent(true);
        builder
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .position(x, y)
            .build()
    };

    #[cfg(target_os = "linux")]
    let result = build_with_retry(build_fn, 3);
    #[cfg(not(target_os = "linux"))]
    let result = build_fn();

    let window = result.map_err(|e| format!("Failed to create task card window: {e}"))?;

    // Re-assert always-on-top after creation — some window managers
    // (notably GNOME/Mutter on Wayland) ignore the builder hint during
    // Alt+Tab and may lower the window. This double-assertion helps.
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let _ = window.set_always_on_top(true);

    if ZEN_MODE.load(Ordering::SeqCst) {
        let _ = window.hide();
    }

    Ok(())
}

// ─── Close Task Card ────────────────────────────────────────────────────

pub fn close_task_card(app: &AppHandle, task_id: i64) {
    let label = format!("task_{}", task_id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.close();
    }
}

/// Re-stack all currently-open task cards vertically, top-to-bottom,
/// right-aligned on the primary monitor. Called when the set of open
/// cards changes (e.g. after a complete or delete) so newly-opened
/// cards don't overlap resized siblings.
pub fn restack_task_cards(app: &AppHandle) {
    let (screen_w, _) = monitor_size(app);
    let x = (screen_w - CARD_WIDTH - RIGHT_MARGIN).max(0.0);

    let mut labels: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|l| l.starts_with("task_"))
        .cloned()
        .collect();

    // Stable order so jitter doesn't shuffle cards on every restack.
    labels.sort();

    let mut y = TOP_MARGIN;
    for label in labels {
        if let Some(window) = app.get_webview_window(&label) {
            let scale = window.scale_factor().unwrap_or(1.0);
            let size = window
                .inner_size()
                .ok()
                .map(|s| LogicalSize::new(s.width as f64 / scale, s.height as f64 / scale))
                .unwrap_or(LogicalSize::new(CARD_WIDTH, CARD_HEIGHT));
            let _ = window.set_position(LogicalPosition::new(x, y));
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let _ = window.set_always_on_top(true);

    #[cfg(target_os = "windows")]
    let _ = window.set_background_color(Some(tauri::utils::config::Color(0, 0, 0, 255)));
            y += size.height + CARD_GAP;
        }
    }
}

/// Open task card windows for all incomplete tasks, stacked vertically.
pub fn open_all_task_cards(app: &AppHandle, tasks: &[Task]) {
    for (i, task) in tasks.iter().enumerate() {
        #[cfg(target_os = "linux")]
        {
            // Stagger each window by 200ms on Linux to prevent WebKitGTK
            // crash from spawning too many WebView processes at once.
            if i > 0 {
                std::thread::sleep(std::time::Duration::from_millis(200 * i as u64));
            }
        }
        let _ = i; // suppress unused warning on non-Linux
        if let Err(e) = open_task_card(app, task, 0) {
            eprintln!(
                "Failed to open task card for task {}: {e}",
                task.id.unwrap_or(0)
            );
        }
    }
    restack_task_cards(app);
}

/// Open a task card window at an explicit position (for workspace restore).
pub fn open_task_card_window_at(app: &AppHandle, task: &Task, x: f64, y: f64) {
    let id = match task.id {
        Some(id) => id,
        None => return,
    };

    let label = format!("task_{}", id);

    if app.get_webview_window(&label).is_some() {
        return;
    }

    let build_fn = || {
        let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("task-card.html".into()))
            .inner_size(CARD_WIDTH, CARD_HEIGHT)
            .resizable(false)
            .decorations(false);
        #[cfg(not(target_os = "macos"))]
        let builder = builder.transparent(true);
        builder
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .position(x, y)
            .build()
    };

    #[cfg(target_os = "linux")]
    let result = build_with_retry(build_fn, 3);
    #[cfg(not(target_os = "linux"))]
    let result = build_fn();

    let window = match result {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to open task card window: {e}");
            return;
        }
    };

    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let _ = window.set_always_on_top(true);

    if ZEN_MODE.load(Ordering::SeqCst) {
        let _ = window.hide();
    }
}

// ─── Quick Add Window ──────────────────────────────────────────────────────────

pub fn open_quick_add_window(app: &AppHandle) {
    let label = "quick_add";

    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }

    let (x, y) = get_quick_add_position(app);

    let build_fn = || {
        let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("quick-add.html".into()))
            .inner_size(480.0, 65.0)
            .resizable(false)
            .decorations(false);
        #[cfg(not(target_os = "macos"))]
        let builder = builder.transparent(true);
        builder
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(true)
            .position(x, y)
            .build()
    };

    #[cfg(target_os = "linux")]
    let result = build_with_retry(build_fn, 3);
    #[cfg(not(target_os = "linux"))]
    let result = build_fn();

    let window = match result {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to open quick add window: {e}");
            return;
        }
    };

    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let _ = window.set_always_on_top(true);

    #[cfg(target_os = "linux")]
    let _ = window.set_visible_on_all_workspaces(true);

    let w_clone = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = w_clone.hide();
        }
    });

    #[cfg(target_os = "windows")]
    let _ = window.set_background_color(Some(tauri::utils::config::Color(0, 0, 0, 255)));
}

fn get_quick_add_position(app: &AppHandle) -> (f64, f64) {
    if let Some(monitor) = app.primary_monitor().ok().flatten() {
        let width = monitor.size().width as f64 / monitor.scale_factor();
        let x = (width / 2.0) - 240.0;
        let y = 80.0;
        return (x, y);
    }
    (400.0, 80.0)
}

// ─── Compact Pill Window ───────────────────────────────────────────────────────

fn get_pill_position(app: &AppHandle) -> (f64, f64) {
    if let Some(monitor) = app.primary_monitor().ok().flatten() {
        let w = monitor.size().width as f64 / monitor.scale_factor();
        let h = monitor.size().height as f64 / monitor.scale_factor();
        return (w - 140.0, h - 80.0);
    }
    (1200.0, 900.0)
}

pub fn open_compact_pill_window(app: &AppHandle) {
    let label = "compact_pill";
    if app.get_webview_window(label).is_some() {
        return;
    }

    let (x, y) = get_pill_position(app);

    let build_fn = || {
        let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("compact-pill.html".into()))
            .inner_size(140.0, 36.0)
            .resizable(false)
            .decorations(false);
        #[cfg(not(target_os = "macos"))]
        let builder = builder.transparent(true);
        builder
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .position(x, y)
            .build()
    };

    #[cfg(target_os = "linux")]
    let result = build_with_retry(build_fn, 3);
    #[cfg(not(target_os = "linux"))]
    let result = build_fn();

    let _window = match result {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to open compact pill window: {e}");
            return;
        }
    };

    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let _ = _window.set_always_on_top(true);
}

pub fn close_compact_pill_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("compact_pill") {
        let _ = w.close();
    }
}

// ─── Edge Peek Window ────────────────────────────────────────────────────────
//
// Geometry rules:
//   • Right edge always flush with the screen right edge
//   • Vertically centered on screen (fixed Y = (screen_h - tab_h) / 2)
//   • Collapsed tab: 80×68 pill, border-radius 34px 0 0 34px (flat right edge)
//   • Expanded panel: 320×80% screen, grows leftward from same top Y
//   • Never moves vertically during expand/collapse

const EDGE_PEEK_TAB_W: f64 = 80.0;
const EDGE_PEEK_TAB_H: f64 = 68.0;
const EDGE_PEEK_EXPANDED_W: f64 = 320.0;

/// Returns (x, y, w, h) in logical pixels, right-edge anchored, vertically centered.
fn edge_peek_geometry(sw: f64, sh: f64, expanded: bool) -> (f64, f64, f64, f64) {
    if expanded {
        let w = EDGE_PEEK_EXPANDED_W;
        let h = (sh * 0.8).clamp(200.0, sh.max(200.0));
        let x = (sw - w).max(0.0);
        let y = ((sh - h) / 2.0).max(0.0);
        (x, y, w, h)
    } else {
        let w = EDGE_PEEK_TAB_W;
        let h = EDGE_PEEK_TAB_H;
        let x = (sw - w).max(0.0);
        let y = ((sh - h) / 2.0).max(0.0);
        (x, y, w, h)
    }
}

fn apply_edge_peek_geometry(window: &tauri::WebviewWindow, expanded: bool) {
    let Some(monitor) = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
    else {
        return;
    };
    let scale = monitor.scale_factor();
    let sw = monitor.size().width as f64 / scale;
    let sh = monitor.size().height as f64 / scale;
    let (x, y, w, h) = edge_peek_geometry(sw, sh, expanded);

    // Order matters for right-edge anchoring:
    //  - Expanding (wider/taller): move first, then grow toward the edge
    //  - Collapsing (narrower/shorter): shrink first, then slide to the edge
    // Doing the reverse briefly hangs the window off-screen, and some WMs
    // clamp it — which looks like a random teleport.
    let current_w = window
        .inner_size()
        .ok()
        .map(|s| s.width as f64 / scale)
        .unwrap_or(w);

    if w >= current_w {
        let _ = window.set_position(LogicalPosition::new(x, y));
        let _ = window.set_size(LogicalSize::new(w, h));
    } else {
        let _ = window.set_size(LogicalSize::new(w, h));
        let _ = window.set_position(LogicalPosition::new(x, y));
    }

    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let _ = window.set_always_on_top(true);
}

pub fn open_edge_peek_window(app: &AppHandle, expanded: bool) {
    let label = "edge_peek";
    if app.get_webview_window(label).is_some() {
        return;
    }

    if let Some(monitor) = app.primary_monitor().ok().flatten() {
        let scale = monitor.scale_factor();
        let sw = monitor.size().width as f64 / scale;
        let sh = monitor.size().height as f64 / scale;
        let (x, y, w, h) = edge_peek_geometry(sw, sh, expanded);

        let build = || {
            let mut builder = WebviewWindowBuilder::new(
                app, label, WebviewUrl::App("edge-peek.html".into()),
            )
            .inner_size(w, h)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .position(x, y);

            // Transparent background for rounded corners to work
            #[cfg(not(target_os = "macos"))]
            {
                builder = builder.transparent(true);
            }

            builder.build()
        };

        #[cfg(target_os = "linux")]
        let result = build_with_retry(build, 3);
        #[cfg(not(target_os = "linux"))]
        let result = build();

        match result {
            Ok(window) => {
                apply_edge_peek_geometry(&window, expanded);
            }
            Err(e) => {
                eprintln!("Failed to open edge peek window: {e}");
            }
        }
    }
}

pub fn close_edge_peek_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("edge_peek") {
        let _ = w.close();
    }
}

pub fn expand_edge_peek(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("edge_peek") {
        apply_edge_peek_geometry(&window, true);
        let _ = window.set_focus();
    }
}

pub fn collapse_edge_peek(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("edge_peek") {
        apply_edge_peek_geometry(&window, false);
    }
}

/// Open the small always-on-top Daily Digest popup (420x220) that
/// summarizes the user's day. The window is centered, non-focusable
/// (so it doesn't steal focus from the main app), and skipped from the
/// taskbar. If it's already open, just focus it.
pub fn open_daily_digest_window(app: &AppHandle) {
    let label = "daily_digest";

    if let Some(w) = app.get_webview_window(label) {
        let _ = w.set_focus();
        return;
    }

    let build_fn = || {
        WebviewWindowBuilder::new(app, label, WebviewUrl::App("daily-digest.html".into()))
            .inner_size(420.0, 220.0)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .center()
            .build()
    };

    #[cfg(target_os = "linux")]
    {
        let _ = build_with_retry(build_fn, 3);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = build_fn().map_err(|e| eprintln!("Failed to open daily digest window: {e}"));
    }
}
