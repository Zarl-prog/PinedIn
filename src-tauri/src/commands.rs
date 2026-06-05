use std::sync::Arc;
use crate::db::{DbHandle, Task};
use crate::window;
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
) -> Result<Task, String> {
    let task = db.create_task(&title, &description, &urgency, &due_time)?;
    emit_tasks_updated(&app, &db);

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
pub fn get_all_tasks(
    db: State<'_, Arc<DbHandle>>,
) -> Result<Vec<Task>, String> {
    db.get_all_tasks()
}

#[tauri::command]
pub fn get_incomplete_tasks(
    db: State<'_, Arc<DbHandle>>,
) -> Result<Vec<Task>, String> {
    db.get_incomplete_tasks()
}

#[tauri::command]
pub fn get_task_by_id(
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<Task, String> {
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
) -> Result<(), String> {
    db.update_task(id, &title, &description, &urgency, &due_time)?;
    emit_tasks_updated(&app, &db);
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
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn complete_task(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<(), String> {
    db.complete_task(id)?;
    window::close_task_card(&app, id);
    emit_tasks_updated(&app, &db);
    Ok(())
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
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(30 * 60));

        // Find the task's position among incomplete tasks
        if let Ok(tasks) = app_clone.state::<Arc<DbHandle>>().get_incomplete_tasks() {
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
pub fn get_settings(
    db: State<'_, Arc<DbHandle>>,
) -> Result<AppSettings, String> {
    db.get_settings()
}

// ─── Autostart Commands ─────────────────────────────────────────────────────

#[tauri::command]
pub fn enable_autostart(app: AppHandle) -> Result<(), String> {
    app.autolaunch().enable().map_err(|e| format!("Failed to enable autostart: {e}"))
}

#[tauri::command]
pub fn disable_autostart(app: AppHandle) -> Result<(), String> {
    app.autolaunch().disable().map_err(|e| format!("Failed to disable autostart: {e}"))
}

#[tauri::command]
pub fn is_autostart_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| format!("Failed to check autostart: {e}"))
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

