use crate::db::{DbHandle, Task};
use crate::notifications;
use crate::window;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager, State, Window};
use tauri_plugin_autostart::ManagerExt;

pub static ZEN_MODE: AtomicBool = AtomicBool::new(false);
pub static COMPACT_MODE: AtomicBool = AtomicBool::new(false);

pub fn emit_tasks_updated(app: &tauri::AppHandle, db: &DbHandle) {
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
    workspace_id: Option<i64>,
) -> Result<Task, String> {
    let task = db.create_task_with_tags(
        &title,
        &description,
        &urgency,
        &due_time,
        recurrence.as_deref(),
        tags.as_deref(),
        time_limit_minutes,
        workspace_id,
    )?;
    emit_tasks_updated(&app, &db);
    notifications::check_due_notifications(&app);

    // Check compact mode before spawning — prevents white flash from
    // briefly opening then immediately closing a task card window.
    if get_compact_mode_state(&app) {
        return Ok(task);
    }

    // Spawn window creation so we don't block the invoke response
    let task_clone = task.clone();
    let app_clone = app.clone();
    let db_clone = Arc::clone(&*db);
    std::thread::spawn(move || {
        // Re-check compact mode in case it changed during the thread spawn
        if get_compact_mode_state(&app_clone) {
            return;
        }
        let index = if task_clone.workspace_id.is_some() {
            db_clone
                .get_workspace_tasks(task_clone.workspace_id.unwrap())
                .ok()
                .and_then(|tasks| tasks.iter().position(|t| t.id == task_clone.id))
                .unwrap_or(0)
        } else {
            db_clone
                .get_incomplete_tasks()
                .ok()
                .and_then(|tasks| tasks.iter().position(|t| t.id == task_clone.id))
                .unwrap_or(0)
        };
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
    time_limit_minutes: Option<i64>,
    started_at: Option<String>,
) -> Result<(), String> {
    db.update_task(
        id,
        &title,
        &description,
        &urgency,
        &due_time,
        recurrence.as_deref(),
        tags.as_deref(),
        time_limit_minutes,
        started_at.as_deref(),
    )?;
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn close_task_card(app: tauri::AppHandle, task_id: i64) -> Result<(), String> {
    window::close_task_card(&app, task_id);
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
            task.workspace_id,
        )?;

        // Mark the original as completed
        db.complete_task(id)?;
        window::close_task_card(&app, id);

        // Open a new floating card for the recurred task
        let app_clone = app.clone();
        let db_clone = Arc::clone(&*db);
        let new_task_clone = new_task.clone();
        std::thread::spawn(move || {
            if !crate::commands::get_compact_mode_state(&app_clone) {
                if let Ok(tasks) = db_clone.get_incomplete_tasks() {
                    let index = tasks
                        .iter()
                        .position(|t| t.id == new_task_clone.id)
                        .unwrap_or(0);
                    let _ = window::open_task_card(&app_clone, &new_task_clone, index);
                }
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

        // Don't open individual cards in compact mode
        if !get_compact_mode_state(&app) {
            // Find the task and its position among incomplete tasks, then open its card
            if let Ok(tasks) = db.get_incomplete_tasks() {
                let index = tasks.iter().position(|t| t.id == Some(id)).unwrap_or(0);
                let _ = window::open_task_card(&app, &task, index);
            }
        }

        emit_tasks_updated(&app, &db);
        notifications::check_due_notifications(&app);
    }
    Ok(())
}

/// Returns `true` if compact mode is currently enabled.
/// Reads from the in-memory AtomicBool — safe to call from any thread
/// with no DB overhead and no TOCTOU race.
pub fn get_compact_mode_state(_app: &AppHandle) -> bool {
    COMPACT_MODE.load(Ordering::SeqCst)
}

/// Advance the due date by the given recurrence interval.
fn advance_due_date(current_date: &str, recurrence: &str) -> String {
    let base_date = chrono::NaiveDate::parse_from_str(current_date, "%Y-%m-%d")
        .unwrap_or_else(|_| chrono::Utc::now().date_naive());

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

        // Don't reopen a card if compact mode is active
        if crate::commands::get_compact_mode_state(&app_clone) {
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
        // Don't reopen a card if compact mode is active
        if crate::commands::get_compact_mode_state(&app_clone) {
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
    app: AppHandle,
    db: State<'_, Arc<DbHandle>>,
    key: String,
    value: String,
) -> Result<(), String> {
    db.update_setting(&key, &value)?;
    if key == "theme" {
        let _ = app.emit("theme_changed", &value);
    }
    Ok(())
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

#[tauri::command]
pub fn get_shake_enabled(db: State<'_, Arc<DbHandle>>) -> Result<bool, String> {
    let map = db.get_settings_map()?;
    let value = map
        .get("shake_enabled")
        .cloned()
        .unwrap_or_else(|| "true".to_string());
    Ok(value == "true")
}

#[tauri::command]
pub fn set_shake_enabled(
    app: AppHandle,
    db: State<'_, Arc<DbHandle>>,
    enabled: bool,
) -> Result<(), String> {
    db.update_setting("shake_enabled", if enabled { "true" } else { "false" })?;
    let _ = app.emit("shake_enabled_updated", enabled);
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

// ─── Daily Digest Toggle ────────────────────────────────────────────────────

#[tauri::command]
pub fn get_daily_digest_enabled(db: State<'_, Arc<DbHandle>>) -> Result<bool, String> {
    let map = db.get_settings_map()?;
    Ok(map.get("daily_digest_enabled").map(|v| v == "true").unwrap_or(false))
}

#[tauri::command]
pub fn set_daily_digest_enabled(
    db: State<'_, Arc<DbHandle>>,
    enabled: bool,
) -> Result<(), String> {
    db.update_setting("daily_digest_enabled", if enabled { "true" } else { "false" })
}

#[tauri::command]
pub fn open_daily_digest_window(app: AppHandle) -> Result<(), String> {
    crate::window::open_daily_digest_window(&app);
    Ok(())
}

#[derive(serde::Serialize)]
pub struct DigestData {
    pub overdue: i64,
    pub due_today: i64,
    pub unfinished_yesterday: i64,
    pub total_active: i64,
}

#[tauri::command]
pub fn get_daily_digest(db: State<'_, Arc<DbHandle>>) -> Result<DigestData, String> {
    let today = chrono::Utc::now().date_naive().to_string();
    let yesterday = (chrono::Utc::now() - chrono::Duration::days(1))
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

// ─── Snap to Grid ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn snap_all_cards_to_grid(app: AppHandle) -> Result<(), String> {
    let windows = app.webview_windows();
    let mut task_windows: Vec<_> = windows
        .into_iter()
        .filter(|(label, _)| label.starts_with("task_"))
        .collect();

    task_windows.sort_by(|a, b| a.0.cmp(&b.0));

    let monitor = app
        .primary_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No monitor found")?;
    let screen_width = monitor.size().width as f64 / monitor.scale_factor();
    let screen_height = monitor.size().height as f64 / monitor.scale_factor();

    let card_width = 300.0;
    let card_height = 120.0;
    let padding = 10.0;
    let x = screen_width - card_width - padding;
    let start_y = 80.0;

    for (i, (_, window)) in task_windows.iter().enumerate() {
        let y = start_y + (i as f64 * (card_height + padding));
        if y + card_height < screen_height {
            let _ = window.set_position(tauri::PhysicalPosition::new(
                (x * monitor.scale_factor()) as i32,
                (y * monitor.scale_factor()) as i32,
            ));
        }
    }
    Ok(())
}

// ─── Workspace Profiles ───────────────────────────────────────────────────────

#[tauri::command]
pub fn save_workspace(app: AppHandle, name: String) -> Result<i64, String> {
    let windows = app.webview_windows();
    let mut cards = vec![];

    for (label, window) in &windows {
        if label.starts_with("task_") {
            let task_id: i64 = label.replace("task_", "").parse().unwrap_or(0);
            if let Ok(pos) = window.outer_position() {
                cards.push(serde_json::json!({
                    "task_id": task_id,
                    "x": pos.x,
                    "y": pos.y
                }));
            }
        }
    }

    let state_json = serde_json::json!({ "cards": cards }).to_string();
    let db = app.state::<Arc<DbHandle>>();
    db.save_workspace(&name, &state_json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_workspaces(app: AppHandle) -> Result<Vec<crate::db::Workspace>, String> {
    let db = app.state::<Arc<DbHandle>>();
    db.get_all_workspaces().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_workspace(app: AppHandle, workspace_id: i64) -> Result<(), String> {
    let db = app.state::<Arc<DbHandle>>();
    let workspace = db.get_workspace_by_id(workspace_id).map_err(|e| e.to_string())?;
    let parsed: serde_json::Value =
        serde_json::from_str(&workspace.state_json).map_err(|e| e.to_string())?;

    let windows = app.webview_windows();
    for (label, window) in &windows {
        if label.starts_with("task_") {
            let _ = window.close();
        }
    }

    // Don't open individual cards in compact mode
    if !get_compact_mode_state(&app) {
        if let Some(cards) = parsed["cards"].as_array() {
            for card in cards {
                let task_id = card["task_id"].as_i64().unwrap_or(0);
                let x = card["x"].as_f64().unwrap_or(100.0);
                let y = card["y"].as_f64().unwrap_or(100.0);
                if let Ok(task) = db.get_task_by_id(task_id) {
                    crate::window::open_task_card_window_at(&app, &task, x, y);
                }
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub fn delete_workspace(app: AppHandle, workspace_id: i64) -> Result<(), String> {
    let db = app.state::<Arc<DbHandle>>();
    db.delete_workspace(workspace_id).map_err(|e| e.to_string())
}

// ─── Compact Mode ──────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_compact_mode(db: State<'_, Arc<DbHandle>>) -> Result<bool, String> {
    let map = db.get_settings_map()?;
    let value = map.get("compact_mode").cloned().unwrap_or_else(|| "false".to_string());
    Ok(value == "true")
}

#[tauri::command]
pub fn set_compact_mode(app: AppHandle, db: State<'_, Arc<DbHandle>>, enabled: bool) -> Result<(), String> {
    db.update_setting("compact_mode", if enabled { "true" } else { "false" })?;
    // Set the AtomicBool first so all spawned threads see the new value
    // immediately — eliminates the TOCTOU race in create_task and snooze.
    COMPACT_MODE.store(enabled, Ordering::SeqCst);

    if enabled {
        // Close all task card windows
        let windows = app.webview_windows();
        for (label, window) in &windows {
            if label.starts_with("task_") {
                let _ = window.close();
            }
        }
        // Open the compact pill
        crate::window::open_compact_pill_window(&app);
        let _ = app.emit("compact_mode_enabled", ());
    } else {
        // Close the compact pill
        crate::window::close_compact_pill_window(&app);
        // Reopen active task card windows — cap at 20 to avoid freezing
        let db = db.inner();
        if let Ok(tasks) = db.get_all_active_tasks() {
            for (i, task) in tasks.iter().take(20).enumerate() {
                let _ = crate::window::open_task_card(&app, task, i);
            }
            crate::window::restack_task_cards(&app);
        }
        let _ = app.emit("compact_mode_disabled", ());
    }
    Ok(())
}

// ─── Zen Mode ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn set_zen_mode(app: AppHandle, hidden: bool) -> Result<(), String> {
    ZEN_MODE.store(hidden, Ordering::SeqCst);
    let windows = app.webview_windows();
    for (label, window) in windows {
        if label.starts_with("task_") {
            if hidden {
                window.hide().map_err(|e| e.to_string())?;
            } else {
                window.show().map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
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

// ─── Pre-Scheduled Tasks ────────────────────────────────────────────────────

#[tauri::command]
pub fn add_presceduled_task(
    app: AppHandle,
    db: State<'_, Arc<DbHandle>>,
    title: String,
    body: String,
    urgency: String,
    scheduled_at: String,
    due_date: Option<String>,
    time_limit_minutes: Option<i64>,
    tags: Option<String>,
    workspace_id: Option<i64>,
) -> Result<i64, String> {
    // Validate scheduled_at is not in the past — parse as RFC 3339/ISO
    // datetime so the comparison is timezone-aware and correct.
    let scheduled_dt = chrono::DateTime::parse_from_rfc3339(&scheduled_at)
        .map_err(|e| format!("Invalid scheduled_at format: {e}"))?;
    if scheduled_dt <= chrono::Utc::now() {
        return Err("scheduled_at must be in the future".to_string());
    }
    let id = db.create_presceduled_task(
        &title,
        &body,
        &urgency,
        &scheduled_at,
        due_date.as_deref().unwrap_or(""),
        time_limit_minutes,
        tags.as_deref(),
        workspace_id,
    )?;
    emit_tasks_updated(&app, &db);
    Ok(id)
}

#[tauri::command]
pub fn get_presceduled_tasks(db: State<'_, Arc<DbHandle>>) -> Result<Vec<Task>, String> {
    db.get_presceduled_tasks()
}

#[tauri::command]
pub fn get_workspace_tasks(db: State<'_, Arc<DbHandle>>, workspace_id: i64) -> Result<Vec<Task>, String> {
    db.get_workspace_tasks(workspace_id)
}

#[tauri::command]
pub fn get_all_workspace_tasks(db: State<'_, Arc<DbHandle>>, workspace_id: i64) -> Result<Vec<Task>, String> {
    db.get_all_workspace_tasks(workspace_id)
}

#[tauri::command]
pub fn activate_workspace(app: AppHandle, db: State<'_, Arc<DbHandle>>, workspace_id: i64) -> Result<(), String> {
    let workspace = db.get_workspace_by_id(workspace_id)?;
    let workspace_name = workspace.name.clone();
    db.update_setting("active_workspace_id", &workspace_id.to_string())?;

    let windows = app.webview_windows();
    for (label, window) in &windows {
        if label.starts_with("task_") {
            let _ = window.close();
        }
    }

    // Don't open individual cards in compact mode
    if !get_compact_mode_state(&app) {
        let tasks = db.get_workspace_tasks(workspace_id)?;
        for (i, task) in tasks.iter().enumerate() {
            let _ = window::open_task_card(&app, task, i);
        }
        window::restack_task_cards(&app);
    }

    let _ = app.emit("workspace_activated", serde_json::json!({ "name": workspace_name }));
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn deactivate_workspace(app: AppHandle, db: State<'_, Arc<DbHandle>>) -> Result<(), String> {
    db.update_setting("active_workspace_id", "")?;

    let windows = app.webview_windows();
    for (label, window) in &windows {
        if label.starts_with("task_") {
            let _ = window.close();
        }
    }

    // Don't open individual cards in compact mode
    if !get_compact_mode_state(&app) {
        if let Ok(tasks) = db.get_incomplete_tasks() {
            for (i, task) in tasks.iter().enumerate() {
                let _ = window::open_task_card(&app, task, i);
            }
            window::restack_task_cards(&app);
        }
    }

    let _ = app.emit("workspace_deactivated", ());
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn get_active_workspace_id(db: State<'_, Arc<DbHandle>>) -> Result<Option<i64>, String> {
    let map = db.get_settings_map()?;
    match map.get("active_workspace_id") {
        Some(val) if !val.is_empty() => {
            val.parse::<i64>().map(Some).map_err(|e| format!("Invalid active_workspace_id: {e}"))
        }
        _ => Ok(None),
    }
}

#[tauri::command]
pub fn add_task_to_workspace(app: AppHandle, db: State<'_, Arc<DbHandle>>, task_id: i64, workspace_id: i64) -> Result<(), String> {
    db.set_task_workspace(task_id, Some(workspace_id))?;
    emit_tasks_updated(&app, &db);
    Ok(())
}

#[tauri::command]
pub fn get_card_position(app: AppHandle, task_id: i64) -> Result<serde_json::Value, String> {
    let mut windows: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|k| k.starts_with("task_"))
        .cloned()
        .collect();
    windows.sort_by(|a, b| {
        let a_id = a.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        let b_id = b.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        a_id.cmp(&b_id)
    });

    let current_label = format!("task_{}", task_id);
    let index = windows.iter().position(|l| l == &current_label).unwrap_or(0);
    let total = windows.len();

    Ok(serde_json::json!({ "index": index, "total": total }))
}

#[tauri::command]
pub fn focus_next_card(app: AppHandle, task_id: i64) -> Result<(), String> {
    let mut windows: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|k| k.starts_with("task_"))
        .cloned()
        .collect();
    windows.sort_by(|a, b| {
        let a_id = a.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        let b_id = b.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        a_id.cmp(&b_id)
    });

    let current_label = format!("task_{}", task_id);
    let current_index = windows.iter().position(|l| l == &current_label).unwrap_or(0);
    if windows.is_empty() {
        return Ok(());
    }
    let next_index = (current_index + 1) % windows.len();
    let next_label = &windows[next_index];

    if let Some(window) = app.get_webview_window(next_label) {
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn focus_prev_card(app: AppHandle, task_id: i64) -> Result<(), String> {
    let mut windows: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|k| k.starts_with("task_"))
        .cloned()
        .collect();
    windows.sort_by(|a, b| {
        let a_id = a.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        let b_id = b.trim_start_matches("task_").parse::<i64>().unwrap_or(0);
        a_id.cmp(&b_id)
    });

    let current_label = format!("task_{}", task_id);
    let current_index = windows.iter().position(|l| l == &current_label).unwrap_or(0);
    if windows.is_empty() {
        return Ok(());
    }
    let prev_index = if current_index == 0 {
        windows.len() - 1
    } else {
        current_index - 1
    };
    let prev_label = &windows[prev_index];

    if let Some(window) = app.get_webview_window(prev_label) {
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn reassert_window_properties(window: Window) -> Result<(), String> {
    #[cfg(any(target_os = "linux", target_os = "windows"))]
    let _ = window.set_always_on_top(true);
    let _ = window.set_skip_taskbar(true);
    Ok(())
}
