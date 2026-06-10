use crate::commands::ZEN_MODE;
use crate::db::Task;
use std::sync::atomic::Ordering;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};

/// Returns `true` if the platform supports transparent windows.
/// On Linux, transparency requires a compositing window manager;
/// Wayland and non-compositing X11 sessions fall back to opaque.
fn supports_transparency() -> bool {
    #[cfg(target_os = "linux")]
    {
        // Check for Wayland — transparency is unreliable there
        if std::env::var("WAYLAND_DISPLAY").is_ok()
            || std::env::var("XDG_SESSION_TYPE")
                .map(|v| v == "wayland")
                .unwrap_or(false)
        {
            return false;
        }
        // X11 without compositor: check for common compositor env vars
        if std::env::var("XDG_SESSION_TYPE")
            .map(|v| v == "x11")
            .unwrap_or(false)
        {
            // Assume compositor is present (most modern desktops).
            // Users on bare X11 without a compositor get opaque windows,
            // which is still functional.
            return true;
        }
    }
    // macOS and Windows support transparency natively
    true
}

const CARD_WIDTH: f64 = 308.0;
const CARD_HEIGHT: f64 = 120.0;
const TOP_MARGIN: f64 = 80.0;
const RIGHT_MARGIN: f64 = 24.0;
const CARD_GAP: f64 = 12.0;

const QUICK_ADD_WIDTH: f64 = 480.0;
const QUICK_ADD_HEIGHT: f64 = 64.0;
const QUICK_ADD_TOP_MARGIN: f64 = 120.0;

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

/// Horizontal center position for the quick-add popup, in logical pixels.
fn get_center_x(app: &AppHandle) -> f64 {
    let (screen_w, _) = monitor_size(app);
    ((screen_w - QUICK_ADD_WIDTH) / 2.0).max(0.0)
}

/// Vertical top position for the quick-add popup. Sits in the upper
/// third of the screen like Spotlight / Raycast, leaving the rest of
/// the desktop visible below.
fn get_top_y(_app: &AppHandle) -> f64 {
    QUICK_ADD_TOP_MARGIN
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

    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("task-card.html".into()))
        .inner_size(CARD_WIDTH, CARD_HEIGHT)
        .resizable(false)
        .decorations(false);

    #[cfg(not(target_os = "macos"))]
    let builder = builder.transparent(supports_transparency());

    let window = builder
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .position(x, y)
        .build()
        .map_err(|e| format!("Failed to create task card window: {e}"))?;

    if ZEN_MODE.load(Ordering::SeqCst) {
        let _ = window.hide();
    }

    Ok(())
}

/// Close a task card window by its task ID.
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
            y += size.height + CARD_GAP;
        }
    }
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

    let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("task-card.html".into()))
        .inner_size(CARD_WIDTH, CARD_HEIGHT)
        .resizable(false)
        .decorations(false);

    #[cfg(not(target_os = "macos"))]
    let builder = builder.transparent(supports_transparency());

    let _ = builder
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .position(x, y)
        .build();

    if ZEN_MODE.load(Ordering::SeqCst) {
        if let Some(window) = app.get_webview_window(&label) {
            let _ = window.hide();
        }
    }
}

/// Open task card windows for all incomplete tasks, stacked vertically.
pub fn open_all_task_cards(app: &AppHandle, tasks: &[Task]) {
    for task in tasks {
        if let Err(e) = open_task_card(app, task, 0) {
            eprintln!(
                "Failed to open task card for task {}: {e}",
                task.id.unwrap_or(0)
            );
        }
    }
    restack_task_cards(app);
}

/// Open a minimal 480x64 quick-add popup, centered horizontally near
/// the top of the primary monitor. If the popup is already open, just
/// focus it instead of creating a second instance. The window is opaque
/// (so its rounded border reads against the desktop), always-on-top,
/// and auto-focused so the user can start typing immediately.
pub fn open_quick_add_window(app: &AppHandle) {
    let label = "quick_add";

    if let Some(w) = app.get_webview_window(label) {
        let _ = w.set_focus();
        return;
    }

    let x = get_center_x(app);
    let y = get_top_y(app);

    WebviewWindowBuilder::new(app, label, WebviewUrl::App("quick-add.html".into()))
        .inner_size(QUICK_ADD_WIDTH, QUICK_ADD_HEIGHT)
        .resizable(false)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(true)
        .position(x, y)
        .build()
        .expect("Failed to open quick add window");
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

    let builder =
        WebviewWindowBuilder::new(app, label, WebviewUrl::App("daily-digest.html".into()))
            .inner_size(420.0, 220.0)
            .resizable(false)
            .decorations(false);

    #[cfg(not(target_os = "macos"))]
    let builder = builder.transparent(supports_transparency());

    builder
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .center()
        .build()
        .expect("Failed to open daily digest window");
}
