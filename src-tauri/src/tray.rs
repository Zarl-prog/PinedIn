use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager,
};

/// Setup the system tray with menu items and event handlers.
/// Uses the shared `paused` AtomicBool so the scheduler thread sees state changes.
pub fn setup_tray(
    app: &AppHandle,
    paused: Arc<AtomicBool>,
) -> Result<(), Box<dyn std::error::Error>> {
    let show_app = MenuItemBuilder::with_id("show_app", "Show App")
        .build(app)?;
    let _ = show_app.set_accelerator(Some("CmdOrCtrl+Shift+P"));

    let quick_task = MenuItemBuilder::with_id("quick_task", "Add Quick Task")
        .build(app)?;
    let _ = quick_task.set_accelerator(Some("CmdOrCtrl+Shift+T"));

    let pause_reminders = MenuItemBuilder::with_id("pause_reminders", "Pause Reminders")
        .build(app)?;
    let _ = pause_reminders.set_accelerator(Some("CmdOrCtrl+Shift+."));

    let quit = MenuItemBuilder::with_id("quit", "Quit PinedIn")
        .build(app)?;
    let _ = quit.set_accelerator(Some("CmdOrCtrl+Q"));

    let menu = MenuBuilder::new(app)
        .item(&show_app)
        .item(&quick_task)
        .separator()
        .item(&pause_reminders)
        .separator()
        .item(&quit)
        .build()?;

    let _tray = TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("PinedIn")
        .on_menu_event(move |app_handle, event| {
            match event.id().as_ref() {
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
                "pause_reminders" => {
                    let currently_paused = paused.load(Ordering::Relaxed);
                    paused.store(!currently_paused, Ordering::Relaxed);

                    if let Some(tray) = app_handle.tray_by_id("main") {
                        let tip = if !currently_paused { "PinedIn (Paused)" } else { "PinedIn" };
                        let _ = tray.set_tooltip(Some(tip));
                    }

                    let _ = app_handle.emit("reminders-paused", !currently_paused);
                }
                "quit" => {
                    app_handle.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}
