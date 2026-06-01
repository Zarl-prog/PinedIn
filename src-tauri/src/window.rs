use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::LogicalPosition;

/// Label for the overlay window that shows active tasks
pub const OVERLAY_WINDOW_LABEL: &str = "task-overlay";

/// Default position offset from bottom-right
const DEFAULT_MARGIN: i32 = 20;

/// Get the primary monitor's work area to position the overlay.
fn get_primary_monitor_size(app: &AppHandle) -> Option<(i32, i32)> {
    if let Some(monitor) = app.primary_monitor().ok().flatten() {
        let size = monitor.size();
        let scale = monitor.scale_factor();
        Some((
            (size.width as f64 / scale) as i32,
            (size.height as f64 / scale) as i32,
        ))
    } else {
        None
    }
}

/// Calculate the default bottom-right position for the overlay
fn default_position(app: &AppHandle, overlay_w: i32, overlay_h: i32) -> LogicalPosition<f64> {
    if let Some((screen_w, screen_h)) = get_primary_monitor_size(app) {
        let x = (screen_w - overlay_w - DEFAULT_MARGIN).max(0);
        let y = (screen_h - overlay_h - DEFAULT_MARGIN).max(0);
        LogicalPosition::new(x as f64, y as f64)
    } else {
        LogicalPosition::new(100.0, 100.0)
    }
}

/// Try to load saved overlay position from the settings database
fn load_saved_position(app: &AppHandle) -> Option<LogicalPosition<f64>> {
    // Access DB through app state
    use crate::db::DbHandle;
    use std::sync::Arc;

    if let Some(db) = app.try_state::<Arc<DbHandle>>() {
        let settings_map = db.get_settings_map().ok()?;
        let x_str = settings_map.get("overlay_pos_x")?;
        let y_str = settings_map.get("overlay_pos_y")?;
        let x: i32 = x_str.parse().ok()?;
        let y: i32 = y_str.parse().ok()?;
        Some(LogicalPosition::new(x as f64, y as f64))
    } else {
        None
    }
}

/// Create or show the always-on-top task overlay window.
pub fn create_or_show_overlay(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let builder = WebviewWindowBuilder::new(
        app,
        OVERLAY_WINDOW_LABEL,
        WebviewUrl::App("index.html?view=overlay".into()),
    )
    .title("Tasks Overlay")
    .inner_size(320.0, 400.0)
    .min_inner_size(320.0, 200.0)
    .max_inner_size(320.0, 500.0)
    .always_on_top(true)
    .skip_taskbar(true)
    .decorations(false)
    .transparent(true)
    .resizable(false);

    let window = builder
        .build()
        .map_err(|e| format!("Failed to create overlay window: {e}"))?;

    // Disable cursor grab so data-tauri-drag-region works properly
    let _ = window.set_cursor_grab(false);

    // Position at saved position, or default to bottom-right
    let pos = load_saved_position(app)
        .unwrap_or_else(|| default_position(app, 320, 400));
    let _ = window.set_position(pos);

    Ok(())
}

/// Close the overlay window
pub fn close_overlay(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        window.close().map_err(|e| format!("Failed to close overlay: {e}"))?;
    }
    Ok(())
}

/// Hide the overlay window
pub fn hide_overlay(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(OVERLAY_WINDOW_LABEL) {
        window.hide().map_err(|e| format!("Failed to hide overlay: {e}"))?;
    }
    Ok(())
}
