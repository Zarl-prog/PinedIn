use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

/// Setup the system tray with menu items and event handlers.
/// Clicking the tray icon toggles the main window's visibility so the
/// app stays running in the background between sessions, exactly like
/// Discord or Spotify. Only the explicit "Quit PinedIn" menu item
/// actually kills the process, and it does so with `std::process::exit`
/// so nothing in the runtime can intercept the shutdown.
pub fn setup_tray(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_app = MenuItemBuilder::with_id("show_app", "Show App").build(app)?;
    let quick_task = MenuItemBuilder::with_id("quick_task", "Add Quick Task").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit PinedIn").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&show_app)
        .item(&quick_task)
        .separator()
        .item(&quit)
        .build()?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("PinedIn")
        .on_menu_event(move |app_handle, event| match event.id().as_ref() {
            "show_app" => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quick_task" => {
                let _ = app_handle.emit("open-quick-task", ());
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => {
                // Use std::process::exit so the process fully dies;
                // app.exit() can be intercepted by other handlers and
                // not actually kill the background tray process.
                std::process::exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Left click and double click both toggle the main window:
            // show+focus if hidden, hide if visible. Matches the
            // Discord / Spotify minimize-to-tray convention.
            let should_toggle = matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } | TrayIconEvent::DoubleClick { .. }
            );
            if should_toggle {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}
