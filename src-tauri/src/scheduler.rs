use crate::db::{DbHandle, Task};
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

    let compact = crate::commands::get_compact_mode_state(app);
    let edge_peek = crate::commands::EDGE_PEEK_ENABLED.load(std::sync::atomic::Ordering::SeqCst);

    // Activate all due tasks and collect the ones we successfully activated.
    let mut activated: Vec<Task> = Vec::new();
    for task in &due {
        let id = match task.id {
            Some(id) => id,
            None => continue,
        };
        if let Err(e) = db.activate_presceduled_task(id) {
            eprintln!("[scheduler] Failed to activate pre-scheduled task {id}: {e}");
            continue;
        }
        activated.push(task.clone());
    }

    if activated.is_empty() {
        return;
    }

    // Emit tasks-updated so the frontend refreshes the task list.
    // This also triggers check_edge_peek_visibility for edge peek mode.
    crate::commands::emit_tasks_updated(app, &db);

    // Open a floating card for each activated task.
    // Spawn each creation in a thread with a staggered delay to avoid
    // deadlocking on Windows when creating transparent webview windows
    // from a background thread.
    if compact {
        // Compact pill — open once (has its own idempotent guard).
        let app_clone = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(100));
            window::open_compact_pill_window(&app_clone);
        });
    } else if !edge_peek {
        // Normal mode — open a floating task card for each activated task.
        for (i, task) in activated.into_iter().enumerate() {
            let app_clone = app.clone();
            std::thread::spawn(move || {
                let delay_ms = 100 + (i as u64 * 100);
                std::thread::sleep(Duration::from_millis(delay_ms));
                if let Err(e) = window::open_task_card(&app_clone, &task, 0) {
                    eprintln!(
                        "[scheduler] Failed to open card for task {}: {e}",
                        task.id.unwrap_or(0)
                    );
                }
            });
        }
    }
}
