use crate::db::DbHandle;
use crate::window;
use chrono::Utc;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Manager};

/// Spawn a background thread that wakes every 30 seconds, finds any
/// pre-scheduled tasks whose `scheduled_at` has arrived, activates them
/// (sets `is_presceduled = 0`), opens a floating card for each, and
/// emits a `tasks-updated` event so the frontend refreshes.
pub fn start_scheduler(app: AppHandle) {
    // Run once on startup in case the user had pre-scheduled tasks
    // whose time arrived while the app was closed.
    check_and_spawn_due_tasks(&app);

    // Then loop every 30 seconds.
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(30));
        check_and_spawn_due_tasks(&app);
    });
}

fn check_and_spawn_due_tasks(app: &AppHandle) {
    let db = match app.try_state::<Arc<DbHandle>>() {
        Some(state) => state,
        None => return,
    };

    let now = Utc::now().to_rfc3339();
    let due = match db.get_due_presceduled_tasks(&now) {
        Ok(tasks) => tasks,
        Err(e) => {
            eprintln!("[scheduler] Failed to query due presceduled tasks: {e}");
            return;
        }
    };

    if due.is_empty() {
        return;
    }

    // Open pill in compact mode, individual cards otherwise
    let compact = crate::commands::get_compact_mode_state(app);
    let edge_peek = crate::commands::EDGE_PEEK_ENABLED.load(std::sync::atomic::Ordering::SeqCst);

    let mut activated_any = false;
    for task in &due {
        let id = match task.id {
            Some(id) => id,
            None => continue,
        };
        if let Err(e) = db.activate_presceduled_task(id) {
            eprintln!("[scheduler] Failed to activate pre-scheduled task {id}: {e}");
            continue;
        }
        activated_any = true;
        if compact {
            crate::window::open_compact_pill_window(app);
        } else if !edge_peek {
            if let Err(e) = window::open_task_card(app, task, 0) {
                eprintln!("[scheduler] Failed to open card for task {id}: {e}");
            }
        }
    }

    if activated_any {
        crate::commands::emit_tasks_updated(app, &db);
    }
}
