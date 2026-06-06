use crate::db::{DbHandle, Task};
use crate::notifications;
use crate::window;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt;

fn emit_tasks_updated(app: &tauri::AppHandle, db: &DbHandle) {
    if let Ok(tasks) = db.get_all_tasks() {
        let _ = app.emit("tasks-updated", serde_json::json!({ "tasks": tasks }));
    }
}

#[tauri::command]
pub fn create_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    title: String,
    description: String,
    urgency: String,
    due_time: String,
    recurrence: Option<String>,
    tags: Option<String>,
    time_limit_minutes: Option<i64>,
) -> Result<Task, String> {
    let task = db.create_task_with_tags(
        &title,
        &description,
        &urgency,
        &due_time,
        recurrence.as_deref(),
        tags.as_deref(),
        time_limit_minutes,
    )?;
    emit_tasks_updated(&app, &db);
    notifications::check_due_notifications(&app);

    // Spawn window creation so we don't block the invoke response
    let task_clone = task.clone();
    let app_clone = app.clone();
    let db_clone = Arc::clone(&*db);
    std::thread::spawn(move || {
        let index = db_clone
            .get_incomplete_tasks()
            .ok()
            .and_then(|tasks| tasks.iter().position(|t| t.id == task_clone.id))
            .unwrap_or(0);
        let _ = window::open_task_card(&app_clone, &task_clone, index);
    });

    Ok(task)
}

#[tauri::command]
pub fn get_all_tasks(db: State<'_, Arc<DbHandle>>) -> Result<Vec<Task>, String> {
    db.get_all_tasks()
}

#[tauri::command]
pub fn get_incomplete_tasks(db: State<'_, Arc<DbHandle>>) -> Result<Vec<Task>, String> {
    db.get_incomplete_tasks()
}

#[tauri::command]
pub fn get_task_by_id(db: State<'_, Arc<DbHandle>>, id: i64) -> Result<Task, String> {
    db.get_task_by_id(id)
}

#[tauri::command]
pub fn update_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
    title: String,
    description: String,
    urgency: String,
    due_time: String,
    recurrence: Option<String>,
    tags: Option<String>,
) -> Result<(), String> {
    db.update_task(
        id,
        &title,
        &description,
        &urgency,
        &due_time,
        recurrence.as_deref(),
        tags.as_deref(),
    )?;
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn trigger_task_edit(app: AppHandle, id: i64) -> Result<(), String> {
    if let Some(main_window) = app.get_webview_window("main") {
        let _ = main_window.show();
        let _ = main_window.unminimize();
        let _ = main_window.set_focus();
        let _ = app.emit("open_edit_task", id);
    }
    Ok(())
}

#[tauri::command]
pub fn delete_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<(), String> {
    db.delete_task(id)?;
    window::close_task_card(&app, id);
    window::restack_task_cards(&app);
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn complete_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<(), String> {
    // Check if task has recurrence before completing
    let task = db.get_task_by_id(id)?;

    if let Some(ref recurrence) = task.recurrence {
        // Advance the due date by the recurrence interval
        let new_due = advance_due_date(&task.due_time, recurrence);

        // Create a new task with the same properties but advanced due date
        let new_task = db.create_task_with_tags(
            &task.title,
            &task.description,
            &task.urgency,
            &new_due,
            Some(recurrence.as_str()),
            task.tags.as_deref(),
            task.time_limit_minutes,
        )?;

        // Mark the original as completed
        db.complete_task(id)?;
        window::close_task_card(&app, id);

        // Open a new floating card for the recurred task
        let app_clone = app.clone();
        let db_clone = Arc::clone(&*db);
        let new_task_clone = new_task.clone();
        std::thread::spawn(move || {
            if let Ok(tasks) = db_clone.get_incomplete_tasks() {
                let index = tasks
                    .iter()
                    .position(|t| t.id == new_task_clone.id)
                    .unwrap_or(0);
                let _ = window::open_task_card(&app_clone, &new_task_clone, index);
            }
        });

        emit_tasks_updated(&app, &db);
        return Ok(());
    }

    db.complete_task(id)?;
    window::close_task_card(&app, id);
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn uncomplete_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<(), String> {
    let task = db.get_task_by_id(id)?;
    if task.completed {
        db.uncomplete_task(id)?;

        // Find the task and its position among incomplete tasks, then open its card
        if let Ok(tasks) = db.get_incomplete_tasks() {
            let index = tasks.iter().position(|t| t.id == Some(id)).unwrap_or(0);
            let _ = window::open_task_card(&app, &task, index);
        }

        emit_tasks_updated(&app, &db);
        notifications::check_due_notifications(&app);
    }
    Ok(())
}

/// Advance the due date by the given recurrence interval.
fn advance_due_date(current_date: &str, recurrence: &str) -> String {
    let base_date = chrono::NaiveDate::parse_from_str(current_date, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Local::now().date_naive());

    let new_date = match recurrence {
        "daily" => base_date + chrono::Duration::days(1),
        "weekly" => base_date + chrono::Duration::days(7),
        "monthly" => base_date
            .checked_add_months(chrono::Months::new(1))
            .unwrap_or(base_date + chrono::Duration::days(30)),
        _ => return current_date.to_string(),
    };

    new_date.format("%Y-%m-%d").to_string()
}

#[tauri::command]
pub fn snooze_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<(), String> {
    // Close the card window
    window::close_task_card(&app, id);

    // Re-read the task data before it goes out of scope
    let task = db.get_task_by_id(id)?;

    // Spawn a thread to reopen the card after 30 minutes
    let app_clone = app.clone();
    let db_clone = Arc::clone(&*db);
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(30 * 60));

        // Bail if the task was deleted, completed, or already has a card
        let still_present = db_clone
            .get_task_by_id(id)
            .map(|t| !t.completed)
            .unwrap_or(false);
        if !still_present {
            return;
        }

        // Find the task's position among incomplete tasks
        if let Ok(tasks) = db_clone.get_incomplete_tasks() {
            let index = tasks.iter().position(|t| t.id == Some(id)).unwrap_or(0);
            let _ = window::open_task_card(&app_clone, &task, index);
        } else {
            let _ = window::open_task_card(&app_clone, &task, 0);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn remind_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
    minutes: u64,
) -> Result<(), String> {
    window::close_task_card(&app, id);

    let task = db.get_task_by_id(id)?;
    let app_clone = app.clone();
    let db_clone = Arc::clone(&*db);
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(minutes * 60));
        let still_present = db_clone
            .get_task_by_id(id)
            .map(|t| !t.completed)
            .unwrap_or(false);
        if !still_present {
            return;
        }
        if let Ok(tasks) = db_clone.get_incomplete_tasks() {
            let index = tasks.iter().position(|t| t.id == Some(id)).unwrap_or(0);
            let _ = window::open_task_card(&app_clone, &task, index);
        } else {
            let _ = window::open_task_card(&app_clone, &task, 0);
        }
    });

    Ok(())
}

#[tauri::command]
pub fn get_settings(db: State<'_, Arc<DbHandle>>) -> Result<AppSettings, String> {
    db.get_settings()
}

// ─── Autostart Commands ─────────────────────────────────────────────────────

#[tauri::command]
pub fn enable_autostart(app: AppHandle) -> Result<(), String> {
    app.autolaunch()
        .enable()
        .map_err(|e| format!("Failed to enable autostart: {e}"))
}

#[tauri::command]
pub fn disable_autostart(app: AppHandle) -> Result<(), String> {
    app.autolaunch()
        .disable()
        .map_err(|e| format!("Failed to disable autostart: {e}"))
}

#[tauri::command]
pub fn is_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch()
        .is_enabled()
        .map_err(|e| format!("Failed to check autostart: {e}"))
}

// ─── Settings Commands ───────────────────────────────────────────────────────

use crate::db::AppSettings;

#[tauri::command]
pub fn update_setting(
    db: State<'_, Arc<DbHandle>>,
    key: String,
    value: String,
) -> Result<(), String> {
    db.update_setting(&key, &value)
}

#[tauri::command]
pub fn get_shake_interval(db: State<'_, Arc<DbHandle>>) -> Result<u64, String> {
    let map = db.get_settings_map()?;
    let value = map
        .get("shake_interval")
        .cloned()
        .unwrap_or_else(|| "30".to_string());
    value
        .parse::<u64>()
        .map_err(|e| format!("Invalid shake_interval: {e}"))
}

#[tauri::command]
pub fn set_shake_interval(
    app: AppHandle,
    db: State<'_, Arc<DbHandle>>,
    seconds: u64,
) -> Result<(), String> {
    db.update_setting("shake_interval", &seconds.to_string())?;
    let _ = app.emit("shake_interval_updated", seconds);
    Ok(())
}

// ─── Update Commands ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;

    let updater = app.updater().map_err(|e| e.to_string())?;
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update
            .download_and_install(|_, _| {}, || {})
            .await
            .map_err(|e| e.to_string())?;
        app.request_restart();
    }
    Ok(())
}

// ─── Daily Digest ──────────────────────────────────────────────────────────

#[derive(serde::Serialize)]
pub struct DigestData {
    pub overdue: i64,
    pub due_today: i64,
    pub unfinished_yesterday: i64,
    pub total_active: i64,
}

#[tauri::command]
pub fn get_daily_digest(db: State<'_, Arc<DbHandle>>) -> Result<DigestData, String> {
    let today = chrono::Local::now().date_naive().to_string();
    let yesterday = (chrono::Local::now() - chrono::Duration::days(1))
        .date_naive()
        .to_string();

    let overdue = db.count_overdue_tasks(&today)?;
    let due_today = db.count_due_today(&today)?;
    let unfinished_yesterday = db.count_unfinished_from_date(&yesterday)?;
    let total_active = db.count_active_tasks()?;

    Ok(DigestData {
        overdue,
        due_today,
        unfinished_yesterday,
        total_active,
    })
}

// ─── Time Limit Notifications ────────────────────────────────────────────────

#[tauri::command]
pub fn fire_time_limit_notification(
    app: AppHandle,
    _task_id: i64,
    task_title: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title("Time's up — PinedIn")
        .body(format!("Time limit reached for: {}", task_title))
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}
