use crate::db::DbHandle;
use chrono::Local;
use std::collections::HashSet;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tauri::{AppHandle, Manager};
use tauri_plugin_notification::NotificationExt;

struct NotificationState {
    notified_ids: HashSet<i64>,
    last_reset_day: String,
}

impl NotificationState {
    fn new() -> Self {
        Self {
            notified_ids: HashSet::new(),
            last_reset_day: String::new(),
        }
    }

    fn reset_if_new_day(&mut self, today: &str) {
        if self.last_reset_day != today {
            self.notified_ids.clear();
            self.last_reset_day = today.to_string();
        }
    }
}

static NOTIFICATION_STATE: OnceLock<Mutex<NotificationState>> = OnceLock::new();

fn notification_state() -> &'static Mutex<NotificationState> {
    NOTIFICATION_STATE.get_or_init(|| Mutex::new(NotificationState::new()))
}

/// Check all incomplete tasks and fire native OS notifications for those
/// whose due_date matches today — deduplicating so each task only
/// notifies once per day regardless of how many times this is called.
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

    let mut state = match notification_state().lock() {
        Ok(s) => s,
        Err(_) => return,
    };
    state.reset_if_new_day(&today);

    for task in &tasks {
        if task.due_time != today {
            continue;
        }
        let id = match task.id {
            Some(id) => id,
            None => continue,
        };
        // Skip if already notified for this task today
        if state.notified_ids.contains(&id) {
            continue;
        }
        let result = app
            .notification()
            .builder()
            .title(&task.title)
            .body("This task is due today")
            .show();

        match result {
            Ok(_) => {
                state.notified_ids.insert(id);
            }
            Err(e) => {
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
