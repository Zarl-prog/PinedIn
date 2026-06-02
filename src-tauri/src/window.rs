use crate::db::Task;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

/// Create a small always-on-top window for a single task card.
/// Windows are stacked vertically starting from top-right of screen.
pub fn open_task_card(app: &AppHandle, task: &Task, index: usize) -> Result<(), String> {
    let id = match task.id {
        Some(id) => id,
        None => return Err("Task has no ID".into()),
    };

    let label = format!("task_{}", id);

    // Don't recreate if already exists
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }

    // Stack vertically: start at y=80 with 110px gap between cards
    let y = 80.0 + (index as f64 * 110.0);

    WebviewWindowBuilder::new(
        app,
        &label,
        WebviewUrl::App("task-card.html".into()),
    )
    .inner_size(280.0, 90.0)
    .resizable(false)
    .decorations(false)
    .transparent(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .focused(false)
    .position(1100.0, y)
    .build()
    .map_err(|e| format!("Failed to create task card window: {e}"))?;

    Ok(())
}

/// Close a task card window by its task ID.
pub fn close_task_card(app: &AppHandle, task_id: i64) {
    let label = format!("task_{}", task_id);
    if let Some(window) = app.get_webview_window(&label) {
        let _ = window.close();
    }
}

/// Open task card windows for all incomplete tasks, stacked vertically.
pub fn open_all_task_cards(app: &AppHandle, tasks: &[Task]) {
    for (i, task) in tasks.iter().enumerate() {
        if let Err(e) = open_task_card(app, task, i) {
            eprintln!("Failed to open task card for task {}: {e}", task.id.unwrap_or(0));
        }
    }
}
