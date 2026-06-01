use std::sync::Arc;
use crate::db::{AppSettings, DbHandle, Task};
use crate::window;
use tauri::{Emitter, State};

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
    let _ = window::create_or_show_overlay(&app);
    emit_tasks_updated(&app, &db);
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
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn get_settings(
    db: State<'_, Arc<DbHandle>>,
) -> Result<AppSettings, String> {
    db.get_settings()
}

#[tauri::command]
pub fn update_setting(
    db: State<'_, Arc<DbHandle>>,
    key: String,
    value: String,
) -> Result<(), String> {
    db.update_setting(&key, &value)
}
