pub mod commands;
pub mod db;
pub mod notifications;
pub mod tray;
pub mod window;

use db::DbHandle;
use std::sync::Arc;
use tauri::Manager;
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
        .plugin(tauri_plugin_global_shortcut::init())
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
                Shortcut::new(Some(Modifiers::CTRL | Modifiers::SHIFT), Code::Space),
                |app, _shortcut, _event| {
                    window::open_quick_add_window(app);
                },
            )?;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
