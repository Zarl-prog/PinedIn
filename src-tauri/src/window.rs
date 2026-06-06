use crate::db::Task;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewUrl, WebviewWindowBuilder};

const CARD_WIDTH: f64 = 280.0;
const CARD_HEIGHT: f64 = 120.0;
const TOP_MARGIN: f64 = 80.0;
const RIGHT_MARGIN: f64 = 24.0;
const CARD_GAP: f64 = 12.0;

fn monitor_size(app: &AppHandle) -> (f64, f64) {
    if let Some(monitor) = app.primary_monitor().ok().flatten().or_else(|| {
        app.available_monitors()
            .ok()
            .and_then(|m| m.into_iter().next())
    }) {
        let scale = monitor.scale_factor();
        let size = monitor.size();
        return (size.width as f64 / scale, size.height as f64 / scale);
    }
    (1920.0, 1080.0)
}

/// Sum the height of all currently-open task card windows.
fn stack_offset_y(app: &AppHandle) -> f64 {
    let mut max_bottom = TOP_MARGIN;
    let windows = app.webview_windows();
    for (label, window) in windows.iter() {
        if !label.starts_with("task_") {
            continue;
        }
        if let (Ok(pos), Ok(size)) = (window.outer_position(), window.outer_size()) {
            let scale = window.scale_factor().unwrap_or(1.0);
            let logical_y = pos.y as f64 / scale;
            let logical_h = size.height as f64 / scale;
            let bottom = logical_y + logical_h;
            if bottom > max_bottom {
                max_bottom = bottom;
            }
        }
    }
    max_bottom
}

/// Create a small always-on-top window for a single task card.
/// Windows are stacked vertically starting from the top-right of the
/// primary monitor, beneath any cards that are already open.
pub fn open_task_card(app: &AppHandle, task: &Task, _index: usize) -> Result<(), String> {
    let id = match task.id {
        Some(id) => id,
        None => return Err("Task has no ID".into()),
    };

    let label = format!("task_{}", id);

    // Don't recreate if already exists
    if app.get_webview_window(&label).is_some() {
        return Ok(());
    }

    let (screen_w, _) = monitor_size(app);
    let x = (screen_w - CARD_WIDTH - RIGHT_MARGIN).max(0.0);
    let y = stack_offset_y(app) + CARD_GAP;

    WebviewWindowBuilder::new(app, &label, WebviewUrl::App("task-card.html".into()))
        .inner_size(CARD_WIDTH, CARD_HEIGHT)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .position(x, y)
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

/// Re-stack all currently-open task cards vertically, top-to-bottom,
/// right-aligned on the primary monitor. Called when the set of open
/// cards changes (e.g. after a complete or delete) so newly-opened
/// cards don't overlap resized siblings.
pub fn restack_task_cards(app: &AppHandle) {
    let (screen_w, _) = monitor_size(app);
    let x = (screen_w - CARD_WIDTH - RIGHT_MARGIN).max(0.0);

    let mut labels: Vec<String> = app
        .webview_windows()
        .keys()
        .filter(|l| l.starts_with("task_"))
        .cloned()
        .collect();

    // Stable order so jitter doesn't shuffle cards on every restack.
    labels.sort();

    let mut y = TOP_MARGIN;
    for label in labels {
        if let Some(window) = app.get_webview_window(&label) {
            let scale = window.scale_factor().unwrap_or(1.0);
            let size = window
                .inner_size()
                .ok()
                .map(|s| LogicalSize::new(s.width as f64 / scale, s.height as f64 / scale))
                .unwrap_or(LogicalSize::new(CARD_WIDTH, CARD_HEIGHT));
            let _ = window.set_position(LogicalPosition::new(x, y));
            y += size.height + CARD_GAP;
        }
    }
}

/// Open task card windows for all incomplete tasks, stacked vertically.
pub fn open_all_task_cards(app: &AppHandle, tasks: &[Task]) {
    for task in tasks {
        if let Err(e) = open_task_card(app, task, 0) {
            eprintln!(
                "Failed to open task card for task {}: {e}",
                task.id.unwrap_or(0)
            );
        }
    }
    restack_task_cards(app);
}
