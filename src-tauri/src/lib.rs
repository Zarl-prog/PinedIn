pub mod commands;
pub mod db;
pub mod tray;

use db::DbHandle;
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

            app.manage(db_handle.clone());

            // Setup system tray
            tray::setup_tray(app.handle())?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_task,
            commands::get_all_tasks,
            commands::get_incomplete_tasks,
            commands::update_task,
            commands::delete_task,
            commands::complete_task,
            commands::get_settings,
            commands::update_setting,
            commands::save_overlay_position,
            commands::get_overlay_position,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
