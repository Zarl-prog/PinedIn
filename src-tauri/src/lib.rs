pub mod commands;
pub mod db;
pub mod scheduler;
pub mod tray;
pub mod window;

use db::DbHandle;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            let db_handle = Arc::new(
                DbHandle::new(app_data_dir).expect("Failed to initialize database"),
            );

            // Manage shared pause state — accessible by both commands and setup hook
            let paused = Arc::new(AtomicBool::new(false));
            app.manage(paused.clone());

            app.manage(db_handle.clone());

            // Setup system tray
            tray::setup_tray(app.handle(), paused.clone())?;

            // Start the reminder scheduler on a background thread
            let app_handle = app.handle().clone();
            scheduler::start_scheduler(app_handle, db_handle, paused);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_task,
            commands::get_all_tasks,
            commands::update_task,
            commands::delete_task,
            commands::complete_task,
            commands::snooze_task,
            commands::get_settings,
            commands::update_setting,
            commands::show_main_window,
            commands::toggle_pause_reminders,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
