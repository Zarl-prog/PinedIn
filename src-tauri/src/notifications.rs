use crate::db::DbHandle;
use chrono::Local;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

/// Check all incomplete tasks and fire native OS notifications for those
/// whose due_date matches today.
pub fn check_due_notifications(app: &AppHandle) {
    let db = app.state::<Arc<DbHandle>>();
    let today = Local::now().format("%Y-%m-%d").to_string();

    let tasks = match db.get_incomplete_tasks() {
        Ok(tasks) => tasks,
        Err(e) => {
            eprintln!("[notifications] Failed to query tasks: {e}");
            return;
        }
    };

    for task in &tasks {
        // due_time is stored as "YYYY-MM-DD" from the date picker
        if task.due_time == today {
            let result = app
                .notification()
                .builder()
                .title(&task.title)
                .body("This task is due today")
                .show();

            if let Err(e) = result {
                eprintln!(
                    "[notifications] Failed to send notification for task '{}': {e}",
                    task.title
                );
            }
        }
    }
}

/// Spawn a background thread that runs the due-date check once immediately
/// and then repeats every 60 minutes.
pub fn start_notification_checker(app: AppHandle) {
    // Run once on startup
    check_due_notifications(&app);

    // Then repeat every hour
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(3600));
        check_due_notifications(&app);
    });
}
