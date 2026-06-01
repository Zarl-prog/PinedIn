use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Label for the reminder popup window
pub const POPUP_WINDOW_LABEL: &str = "reminder-popup";

/// Create or show the always-on-top reminder popup window.
/// The popup is a separate window that stays on top of all other windows.
pub fn create_or_show_popup(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(POPUP_WINDOW_LABEL) {
        let _ = window.show();
        let _ = window.set_focus();
        return Ok(());
    }

    let _window = WebviewWindowBuilder::new(
        app,
        POPUP_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("PinedIn - Reminder")
    .inner_size(420.0, 320.0)
    .min_inner_size(380.0, 280.0)
    .always_on_top(true)
    .skip_taskbar(true)
    .decorations(true)
    .center()
    .resizable(true)
    .build()
    .map_err(|e| format!("Failed to create popup window: {}", e))?;

    Ok(())
}

/// Close the reminder popup window
pub fn close_popup(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(POPUP_WINDOW_LABEL) {
        window.close().map_err(|e| format!("Failed to close popup: {}", e))?;
    }
    Ok(())
}

/// Hide the reminder popup window
pub fn hide_popup(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(POPUP_WINDOW_LABEL) {
        window.hide().map_err(|e| format!("Failed to hide popup: {}", e))?;
    }
    Ok(())
}

/// Focus the reminder popup window
pub fn focus_popup(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(POPUP_WINDOW_LABEL) {
        window.set_focus().map_err(|e| format!("Failed to focus popup: {}", e))?;
    }
    Ok(())
}
