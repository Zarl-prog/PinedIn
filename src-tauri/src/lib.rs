pub mod commands;
pub mod db;
pub mod notifications;
pub mod tray;
pub mod window;

use db::DbHandle;
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_notification::NotificationExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let db_handle =
                Arc::new(DbHandle::new(app_data_dir).expect("Failed to initialize database"));

            app.manage(db_handle.clone());

            // Force remove native decorations — must run after window-state plugin
            // restores its state, so we post it to the event loop
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_decorations(false);
                // Also hide and re-show to force Windows to redraw without native frame
                let _ = win.hide();
                let _ = win.show();
            }

            // Setup system tray
            tray::setup_tray(app.handle())?;

            // Open floating task cards for all incomplete tasks
            if let Ok(tasks) = db_handle.get_incomplete_tasks() {
                window::open_all_task_cards(app.handle(), &tasks);
            }

            // Request notification permission, then fire notifications for tasks due today
            // and start the hourly background checker
            let _ = app.handle().notification().request_permission();
            notifications::start_notification_checker(app.handle().clone());

            // Register global hotkey: Ctrl+Shift+Space opens quick-add popup from anywhere,
            // even when the main window is minimized or not focused.
            app.global_shortcut().on_shortcut(
                Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::Space),
                |app, _shortcut, _event| {
                    window::open_quick_add_window(app);
                },
            )?;

            // Spawn a background update check on startup - silent unless one is found
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates(handle).await;
            });

            // Open the daily digest popup 2s after launch so the main
            // window has time to render first. Using spawn_blocking with
            // std::thread::sleep avoids pulling in a tokio dep just for
            // a one-shot timer.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                std::thread::sleep(std::time::Duration::from_secs(2));
                window::open_daily_digest_window(&handle);
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_task,
            commands::get_all_tasks,
            commands::get_incomplete_tasks,
            commands::get_task_by_id,
            commands::update_task,
            commands::delete_task,
            commands::complete_task,
            commands::uncomplete_task,
            commands::snooze_task,
            commands::remind_task,
            commands::enable_autostart,
            commands::disable_autostart,
            commands::is_autostart_enabled,
            commands::get_settings,
            commands::update_setting,
            commands::get_shake_interval,
            commands::set_shake_interval,
            commands::trigger_task_edit,
            commands::install_update,
            commands::get_daily_digest,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn check_for_updates(app: tauri::AppHandle) {
    use tauri_plugin_updater::UpdaterExt;
    if let Ok(updater) = app.updater() {
        if let Ok(Some(update)) = updater.check().await {
            let _ = app.emit("update_available", update.version.clone());
        }
    }
}
