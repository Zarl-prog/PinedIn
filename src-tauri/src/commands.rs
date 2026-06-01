use std::sync::atomic::Ordering;
use std::sync::Arc;
use crate::db::{AppSettings, DbHandle, Task};
use tauri::{Manager, State};

#[tauri::command]
pub fn create_task(
    db: State<'_, Arc<DbHandle>>,
    title: String,
    description: String,
    urgency: String,
    due_time: String,
    repeat: bool,
) -> Result<Task, String> {
    db.create_task(&title, &description, &urgency, &due_time, repeat)
}

#[tauri::command]
pub fn get_all_tasks(
    db: State<'_, Arc<DbHandle>>,
) -> Result<Vec<Task>, String> {
    db.get_all_tasks()
}

#[tauri::command]
pub fn update_task(
    db: State<'_, Arc<DbHandle>>,
    id: i64,
    title: String,
    description: String,
    urgency: String,
    due_time: String,
    repeat: bool,
) -> Result<(), String> {
    db.update_task(id, &title, &description, &urgency, &due_time, repeat)
}

#[tauri::command]
pub fn delete_task(
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<(), String> {
    db.delete_task(id)
}

#[tauri::command]
pub fn complete_task(
    db: State<'_, Arc<DbHandle>>,
    id: i64,
) -> Result<(), String> {
    db.complete_task(id)
}

#[tauri::command]
pub fn snooze_task(
    db: State<'_, Arc<DbHandle>>,
    id: i64,
    snooze_minutes: i32,
) -> Result<(), String> {
    db.snooze_task(id, snooze_minutes)
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

#[tauri::command]
pub fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        window.show().map_err(|e| format!("Failed to show window: {}", e))?;
        window.set_focus().map_err(|e| format!("Failed to focus window: {}", e))?;
    }
    Ok(())
}

/// Toggle pause state — updates both the DB setting AND the shared AtomicBool
/// so that the scheduler thread immediately sees the change.
#[tauri::command]
pub fn toggle_pause_reminders(
    app: tauri::AppHandle,
    db: State<'_, Arc<DbHandle>>,
    paused: State<'_, Arc<std::sync::atomic::AtomicBool>>,
) -> Result<bool, String> {
    let current = paused.load(Ordering::Relaxed);
    paused.store(!current, Ordering::Relaxed);

    let new_value = if !current { "true" } else { "false" };
    db.update_setting("reminders_paused", new_value)?;

    if let Some(tray) = app.tray_by_id("main") {
        let tip = if !current { "PinedIn (Paused)" } else { "PinedIn" };
        let _ = tray.set_tooltip(Some(tip));
    }

    Ok(!current)
}
