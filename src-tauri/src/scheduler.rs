use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use crate::db::{DbHandle, Task};

/// Start the reminder scheduler on its own thread.
/// Uses the same `paused` AtomicBool that the tray toggles.
/// Cleans up stale notified entries every 10 cycles to prevent memory leaks.
pub fn start_scheduler(
    app_handle: AppHandle,
    db_handle: Arc<DbHandle>,
    paused: Arc<AtomicBool>,
) {
    std::thread::spawn(move || {
        let mut notified_task_ids: Vec<i64> = Vec::new();
        let mut last_notified_time: std::collections::HashMap<i64, chrono::DateTime<chrono::Utc>> =
            std::collections::HashMap::new();
        let mut cleanup_counter: u32 = 0;

        loop {
            std::thread::sleep(std::time::Duration::from_secs(30));
            cleanup_counter += 1;

            // Skip if paused — same AtomicBool the tray toggles via toggle_pause_reminders
            if paused.load(Ordering::Relaxed) {
                continue;
            }

            // Skip if in quiet hours
            if let Ok(true) = db_handle.is_in_quiet_hours() {
                continue;
            }

            // Get due tasks
            let due_tasks = match db_handle.get_due_tasks() {
                Ok(tasks) => tasks,
                Err(_) => continue,
            };

            // Every ~5 minutes (10 cycles × 30s), prune stale entries for tasks no longer due
            if cleanup_counter >= 10 && !notified_task_ids.is_empty() {
                cleanup_counter = 0;
                let due_ids: std::collections::HashSet<i64> =
                    due_tasks.iter().filter_map(|t| t.id).collect();
                notified_task_ids.retain(|id| due_ids.contains(id));
                last_notified_time.retain(|id, _| due_ids.contains(id));
            }

            if due_tasks.is_empty() {
                continue;
            }

            let now = chrono::Utc::now();
            let mut tasks_to_notify: Vec<Task> = Vec::new();

            for task in &due_tasks {
                let task_id = task.id.unwrap_or(0);

                if notified_task_ids.contains(&task_id) {
                    if let Some(last_time) = last_notified_time.get(&task_id) {
                        if (now - *last_time).num_minutes() >= 2 {
                            tasks_to_notify.push(task.clone());
                            last_notified_time.insert(task_id, now);
                        }
                    }
                } else {
                    tasks_to_notify.push(task.clone());
                    notified_task_ids.push(task_id);
                    last_notified_time.insert(task_id, now);
                }
            }

            if !tasks_to_notify.is_empty() {
                for task in &tasks_to_notify {
                    let payload = serde_json::json!({
                        "task": task,
                        "is_re_trigger": notified_task_ids.contains(&task.id.unwrap_or(0)),
                        "timestamp": now.to_rfc3339(),
                    });
                    let _ = app_handle.emit("reminder-due", payload);
                }

                let bulk_payload = serde_json::json!({
                    "tasks": tasks_to_notify,
                    "count": tasks_to_notify.len(),
                    "timestamp": now.to_rfc3339(),
                });
                let _ = app_handle.emit("reminders-due-bulk", bulk_payload);
            }
        }
    });
}
