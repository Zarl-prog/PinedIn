use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri::LogicalPosition;

/// Label for the overlay window that shows active tasks
pub const OVERLAY_WINDOW_LABEL: &str = "task-overlay";

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

/// Create or show the always-on-top task overlay window.
/// The overlay is a persistent small window anchored to the bottom-right corner.
/// It is never destroyed between operations — content updates via Tauri events.
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
    .min_inner_size(280.0, 200.0)
    .max_inner_size(480.0, 800.0)
    .always_on_top(true)
    .skip_taskbar(true)
    .decorations(false)
    .resizable(true);

    let window = builder
        .build()
        .map_err(|e| format!("Failed to create overlay window: {e}"))?;

    // Position at bottom-right corner
    if let Some((screen_w, screen_h)) = get_primary_monitor_size(app) {
        let overlay_w = 320;
        let x = (screen_w - overlay_w).max(0);
        let y = (screen_h - 400).max(0);
        let _ = window.set_position(LogicalPosition::new(x as f64, y as f64));
    }

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
