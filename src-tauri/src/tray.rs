use crate::QuitFlag;
use std::sync::atomic::Ordering;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

pub fn is_gnome() -> bool {
    std::env::var("XDG_CURRENT_DESKTOP")
        .unwrap_or_default()
        .to_lowercase()
        .contains("gnome")
}

/// Setup the system tray with menu items and event handlers.
/// Clicking the tray icon toggles the main window's visibility so the
/// app stays running in the background between sessions, exactly like
/// Discord or Spotify. Only the explicit "Quit PinedIn" menu item
/// actually kills the process; it flips the shared `QuitFlag` and then
/// calls `app.exit(0)` so the main window's close-to-tray handler
/// knows to let the next close event through to the OS.
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

    // On Windows the tray icon MUST have an icon set, otherwise it
    // won't appear in the notification area at all. Fall back from
    // the bundle's default window icon to a 1x1 transparent image so
    // the build never fails on a missing-asset edge case.
    let icon: Image<'_> = app
        .default_window_icon()
        .cloned()
        .unwrap_or_else(|| Image::new(&[0; 4], 1, 1));

    // macOS convention: menu bar icons show menu on left-click.
    // Windows/Linux: left-click toggles the app window instead.
    #[cfg(target_os = "macos")]
    let show_menu = true;
    #[cfg(not(target_os = "macos"))]
    let show_menu = false;

    let tray = TrayIconBuilder::new()
        .icon(icon)
        .tooltip("PinedIn")
        .menu(&menu)
        .show_menu_on_left_click(show_menu)
        .on_menu_event(move |app_handle, event| match event.id().as_ref() {
            "show_app" => {
                if let Some(window) = app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.unminimize();
                    let _ = window.set_focus();
                }
            }
            "quick_task" => {
                // Spawn in a thread to avoid deadlocking on Windows when
                // creating transparent webview windows from tray events.
                let ah = app_handle.clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(100));
                    crate::window::open_quick_add_window(&ah);
                });
            }
            "quit" => {
                // Flip the shared quit flag so the main window's
                // CloseRequested handler lets the next close go
                // through to the OS, then ask Tauri to exit. This
                // gives a clean shutdown (DB closes, plugins unload)
                // instead of the abrupt std::process::exit(0).
                let flag = app_handle.state::<QuitFlag>();
                flag.0.store(true, Ordering::SeqCst);
                app_handle.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            // Left click and double click both toggle the main window:
            // show+focus if hidden, hide if visible.
            // Note: TrayIconEvent::DoubleClick does not fire reliably
            // on macOS menu bar icons, so it's excluded on that platform.
            let should_toggle = matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) || (cfg!(not(target_os = "macos"))
                && matches!(event, TrayIconEvent::DoubleClick { .. }));
            if should_toggle {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.unminimize();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    // Keep the tray icon alive for the lifetime of the app. Without
    // this, the builder's return value is dropped at end of scope and
    // the icon can disappear or stop receiving events on some
    // platforms.
    app.manage(tray);

    Ok(())
}
