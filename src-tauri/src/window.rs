use crate::commands::ZEN_MODE;
use crate::db::Task;
use std::sync::atomic::Ordering;
use std::sync::OnceLock;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Position, Size, WebviewUrl, WebviewWindowBuilder};

pub const CARD_WIDTH: f64 = 308.0;
pub const CARD_HEIGHT: f64 = 120.0;
const TOP_MARGIN: f64 = 80.0;
const RIGHT_MARGIN: f64 = 24.0;
const CARD_GAP: f64 = 12.0;

#[cfg(target_os = "linux")]
fn build_with_retry<F>(build_fn: F, max_retries: u32) -> Result<tauri::WebviewWindow, tauri::Error>
where
    F: Fn() -> Result<tauri::WebviewWindow, tauri::Error>,
{
    let mut last_error = None;
    for attempt in 0..max_retries {
        match build_fn() {
            Ok(window) => return Ok(window),
            Err(e) => {
                eprintln!("Window creation attempt {} failed: {}", attempt + 1, e);
                last_error = Some(e);
                if attempt + 1 < max_retries {
                    std::thread::sleep(std::time::Duration::from_millis(500));
                }
            }
        }
    }
    Err(last_error.unwrap_or_else(|| {
        eprintln!("[window] build_with_retry: max_retries=0 or no error captured");
        tauri::Error::WindowNotFound
    }))
}

/// Monotonic generation counter for edge-peek geometry changes. Each
/// expand/collapse bumps it; the Linux delayed re-assert only applies if its
/// generation is still current, so a stale thread can't yank a resized window
/// to an old position (which caused drift/ghosting on rapid toggling).
static EDGE_PEEK_GEN: OnceLock<std::sync::atomic::AtomicU64> = OnceLock::new();

fn bump_edge_peek_gen() -> u64 {
    let atomic = EDGE_PEEK_GEN.get_or_init(|| std::sync::atomic::AtomicU64::new(0));
    atomic.fetch_add(1, Ordering::SeqCst) + 1
}

#[cfg(target_os = "linux")]
fn current_edge_peek_gen() -> u64 {
    let atomic = EDGE_PEEK_GEN.get_or_init(|| std::sync::atomic::AtomicU64::new(0));
    atomic.load(Ordering::SeqCst)
}

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

    let build_fn = || {
        let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("task-card.html".into()))
            .inner_size(CARD_WIDTH, CARD_HEIGHT)
            .resizable(false)
            .decorations(false);
        #[cfg(not(target_os = "macos"))]
        let builder = builder.transparent(true);
        builder
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .position(x, y)
            .build()
    };

    #[cfg(target_os = "linux")]
    let result = build_with_retry(build_fn, 3);
    #[cfg(not(target_os = "linux"))]
    let result = build_fn();

    let window = result.map_err(|e| format!("Failed to create task card window: {e}"))?;

    // Re-assert always-on-top after creation on Linux only — GNOME/Mutter
    // on Wayland may drop the builder hint during Alt+Tab. Windows/macOS
    // honour it natively so the re-assert is just noise.
    #[cfg(target_os = "linux")]
    let _ = window.set_always_on_top(true);

    if ZEN_MODE.load(Ordering::SeqCst) {
        let _ = window.hide();
    }

    Ok(())
}

// ─── Close Task Card ────────────────────────────────────────────────────

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
            #[cfg(target_os = "linux")]
            let _ = window.set_always_on_top(true);
            y += size.height + CARD_GAP;
        }
    }
}

/// Open task card windows for all incomplete tasks, stacked vertically.
pub fn open_all_task_cards(app: &AppHandle, tasks: &[Task]) {
    let app = app.clone();
    let tasks: Vec<Task> = tasks.to_vec();
    std::thread::spawn(move || {
        for (_i, task) in tasks.iter().enumerate() {
            #[cfg(target_os = "linux")]
            {
                if _i > 0 {
                    std::thread::sleep(std::time::Duration::from_millis(200));
                }
            }
            if let Err(e) = open_task_card(&app, task, 0) {
                eprintln!(
                    "Failed to open task card for task {}: {e}",
                    task.id.unwrap_or(0)
                );
            }
        }
        restack_task_cards(&app);
    });
}

/// Open a task card window at an explicit position (for workspace restore).
pub fn open_task_card_window_at(app: &AppHandle, task: &Task, x: f64, y: f64) {
    let id = match task.id {
        Some(id) => id,
        None => return,
    };

    let label = format!("task_{}", id);

    if app.get_webview_window(&label).is_some() {
        return;
    }

    let build_fn = || {
        let builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App("task-card.html".into()))
            .inner_size(CARD_WIDTH, CARD_HEIGHT)
            .resizable(false)
            .decorations(false);
        #[cfg(not(target_os = "macos"))]
        let builder = builder.transparent(true);
        builder
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .position(x, y)
            .build()
    };

    #[cfg(target_os = "linux")]
    let result = build_with_retry(build_fn, 3);
    #[cfg(not(target_os = "linux"))]
    let result = build_fn();

    let window = match result {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to open task card window: {e}");
            return;
        }
    };

    #[cfg(target_os = "linux")]
    let _ = window.set_always_on_top(true);

    if ZEN_MODE.load(Ordering::SeqCst) {
        let _ = window.hide();
    }
}

// ─── Quick Add Window ──────────────────────────────────────────────────────────

pub fn open_quick_add_window(app: &AppHandle) {
    let label = "quick_add";

    if let Some(w) = app.get_webview_window(label) {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }

    let (x, y) = get_quick_add_position(app);

    let build_fn = || {
        let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("quick-add.html".into()))
            .inner_size(480.0, 65.0)
            .resizable(false)
            .decorations(false);
        #[cfg(not(target_os = "macos"))]
        let builder = builder.transparent(true);
        builder
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(true)
            .position(x, y)
            .build()
    };

    #[cfg(target_os = "linux")]
    let result = build_with_retry(build_fn, 3);
    #[cfg(not(target_os = "linux"))]
    let result = build_fn();

    let window = match result {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to open quick add window: {e}");
            return;
        }
    };

    #[cfg(target_os = "linux")]
    let _ = window.set_always_on_top(true);

    #[cfg(target_os = "linux")]
    let _ = window.set_visible_on_all_workspaces(true);

    let w_clone = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = w_clone.hide();
        }
    });

}

fn get_quick_add_position(app: &AppHandle) -> (f64, f64) {
    if let Some(monitor) = app.primary_monitor().ok().flatten() {
        let width = monitor.size().width as f64 / monitor.scale_factor();
        let x = (width / 2.0) - 240.0;
        let y = 80.0;
        return (x, y);
    }
    (400.0, 80.0)
}

// ─── Compact Pill Window ───────────────────────────────────────────────────────

fn get_pill_position(app: &AppHandle) -> (f64, f64) {
    if let Some(monitor) = app.primary_monitor().ok().flatten() {
        let w = monitor.size().width as f64 / monitor.scale_factor();
        let h = monitor.size().height as f64 / monitor.scale_factor();
        return (w - 100.0, h - 80.0);
    }
    (1200.0, 900.0)
}

pub fn open_compact_pill_window(app: &AppHandle) {
    let label = "compact_pill";
    if app.get_webview_window(label).is_some() {
        return;
    }

    let (x, y) = get_pill_position(app);

    let build_fn = || {
        let builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App("compact-pill.html".into()))
            .inner_size(100.0, 36.0)
            .resizable(false)
            .decorations(false);
        #[cfg(not(target_os = "macos"))]
        let builder = builder.transparent(true);
        builder
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .position(x, y)
            .build()
    };

    #[cfg(target_os = "linux")]
    let result = build_with_retry(build_fn, 3);
    #[cfg(not(target_os = "linux"))]
    let result = build_fn();

    let _window = match result {
        Ok(w) => w,
        Err(e) => {
            eprintln!("Failed to open compact pill window: {e}");
            return;
        }
    };

    #[cfg(target_os = "linux")]
    let _ = _window.set_always_on_top(true);
}

pub fn close_compact_pill_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("compact_pill") {
        let _ = w.close();
    }
}

// ─── Edge Peek Window ────────────────────────────────────────────────────────
//
// Geometry rules:
//   • Right edge always flush with the screen right edge
//   • Default Y: 100px from top (pill top at ~100px from screen top)
//   • Collapsed tab: 80×48 pill, border-radius 24px 0 0 24px (flat right edge)
//   • Expanded strip: fixed 340px width, grows leftward from same anchor Y
//   • Height and Y stay fixed — no vertical movement during expand/collapse

const EDGE_PEEK_TAB_W: f64 = 80.0;
const EDGE_PEEK_TAB_H: f64 = 56.0;
const EDGE_PEEK_EXPANDED_W: f64 = 340.0;
const EDGE_PEEK_EXPANDED_H: f64 = 56.0;

/// Default Y offset from top of screen to the top edge of the pill.
const EDGE_PEEK_TOP_OFFSET: f64 = 100.0;

/// Returns (x, y, w, h) in logical pixels, right-edge anchored.
/// Height stays fixed — expanding only widens leftward.
/// Y is clamped so the window stays fully on-screen.
fn edge_peek_geometry(sw: f64, sh: f64, ox: f64, oy: f64, expanded: bool) -> (f64, f64, f64, f64) {
    let anchor_y = get_anchor_center_y();
    if anchor_y.is_nan() {
        set_anchor_center_y(EDGE_PEEK_TOP_OFFSET);
    }

    let (w, h) = if expanded {
        (EDGE_PEEK_EXPANDED_W, EDGE_PEEK_EXPANDED_H)
    } else {
        (EDGE_PEEK_TAB_W, EDGE_PEEK_TAB_H)
    };
    let x = ox + (sw - w).max(0.0);
    let max_y = oy + (sh - h).max(0.0);
    let y = get_anchor_center_y().clamp(oy, max_y);
    (x, y, w, h)
}

fn apply_edge_peek_geometry(window: &tauri::WebviewWindow, expanded: bool) {
    let Some(monitor) = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten())
    else {
        eprintln!("[edge_peek] no monitor available, skipping geometry update");
        return;
    };
    let scale = monitor.scale_factor();
    let sw = monitor.size().width as f64 / scale;
    let sh = monitor.size().height as f64 / scale;
    let pos = monitor.position();
    let ox = pos.x as f64 / scale;
    let oy = pos.y as f64 / scale;
    let (x, y, w, h) = edge_peek_geometry(sw, sh, ox, oy, expanded);

    // Always update Tauri's internal state first — this is the source of truth
    // for the webview bounds cache. Without it WebView2 content layout desyncs
    // from the native window on Windows (B1).
    let gen = bump_edge_peek_gen();
    let _ = window.set_size(Size::Logical(LogicalSize::new(w, h)));
    let _ = window.set_position(Position::Logical(LogicalPosition::new(x, y)));

    #[cfg(target_os = "windows")]
    {
        // Reinforce with the native API so the OS sees the change immediately,
        // but never bypass Tauri's internal state (B1). Use SWP_ASYNCWINDOWPOS
        // because commands run on tokio threads, not the UI thread — a
        // synchronous SetWindowPos could deadlock (B2).
        if let Ok(hwnd) = window.hwnd() {
            let hwnd: windows::Win32::Foundation::HWND = hwnd;
            if unsafe {
                windows::Win32::UI::WindowsAndMessaging::IsWindow(hwnd).as_bool()
            } {
                let x_px = (x * scale).round() as i32;
                let y_px = (y * scale).round() as i32;
                let w_px = (w * scale).round().max(1.0) as i32;
                let h_px = (h * scale).round().max(1.0) as i32;
                unsafe {
                    let ok = windows::Win32::UI::WindowsAndMessaging::SetWindowPos(
                        hwnd,
                        None,
                        x_px, y_px, w_px, h_px,
                        windows::Win32::UI::WindowsAndMessaging::SWP_NOZORDER
                            | windows::Win32::UI::WindowsAndMessaging::SWP_NOACTIVATE
                            | windows::Win32::UI::WindowsAndMessaging::SWP_NOOWNERZORDER
                            | windows::Win32::UI::WindowsAndMessaging::SWP_ASYNCWINDOWPOS,
                    );
                    if let Err(e) = ok {
                        eprintln!(
                            "[edge_peek] SetWindowPos failed: {}",
                            e
                        );
                    }
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let win = window.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(30));
            // Only re-assert if no newer expand/collapse happened meanwhile —
            // otherwise a stale thread would drag the resized window to an old
            // position, causing it to drift off the edge or leave a ghost.
            if current_edge_peek_gen() != gen {
                return;
            }
            let _ = win.set_size(Size::Logical(LogicalSize::new(w, h)));
            let _ = win.set_position(Position::Logical(LogicalPosition::new(x, y)));
        });
    }
    #[cfg(not(target_os = "linux"))]
    let _ = gen;
}

pub fn open_edge_peek_window(app: &AppHandle, expanded: bool) {
    let label = "edge_peek";

    // Don't recreate if already exists (idempotent guard)
    if app.get_webview_window(label).is_some() {
        return;
    }

    let monitor = app
        .get_webview_window("main")
        .and_then(|w| w.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());
    if let Some(monitor) = monitor {
        let scale = monitor.scale_factor();
        let sw = monitor.size().width as f64 / scale;
        let sh = monitor.size().height as f64 / scale;
        let pos = monitor.position();
        let ox = pos.x as f64 / scale;
        let oy = pos.y as f64 / scale;
        let (x, y, w, h) = edge_peek_geometry(sw, sh, ox, oy, expanded);

        let build = || {
            let builder = WebviewWindowBuilder::new(
                app, label, WebviewUrl::App("edge-peek.html".into()),
            )
            .inner_size(w, h)
            .resizable(false)
            .decorations(false);
            #[cfg(not(target_os = "macos"))]
            let builder = builder.transparent(true);
            builder
                .shadow(false)
                .always_on_top(true)
                .skip_taskbar(true)
                .focused(false)
                .position(x, y)
                .build()
        };

        #[cfg(target_os = "linux")]
        let result = build_with_retry(build, 3);
        #[cfg(not(target_os = "linux"))]
        let result = build();

        if let Err(e) = result {
            eprintln!("Failed to open edge peek window: {e}");
        }
    } else {
        eprintln!("[edge_peek] no primary monitor, cannot open window");
    }
}

pub fn close_edge_peek_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("edge_peek") {
        let _ = w.close();
    }
}

pub fn expand_edge_peek(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("edge_peek") {
        // Edge peek is a supplementary overlay — never steal focus from the
        // window the user is actually working in. Just resize/reposition.
        apply_edge_peek_geometry(&window, true);
    }
}

pub fn collapse_edge_peek(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("edge_peek") {
        apply_edge_peek_geometry(&window, false);
    }
}


/// Open the small always-on-top Daily Digest popup (420x220) that
/// summarizes the user's day. The window is centered, non-focusable
/// (so it doesn't steal focus from the main app), and skipped from the
/// taskbar. If it's already open, just focus it.
pub fn open_daily_digest_window(app: &AppHandle) {
    let label = "daily_digest";

    if let Some(w) = app.get_webview_window(label) {
        let _ = w.set_focus();
        return;
    }

    let build_fn = || {
        WebviewWindowBuilder::new(app, label, WebviewUrl::App("daily-digest.html".into()))
            .inner_size(420.0, 220.0)
            .resizable(false)
            .decorations(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .center()
            .build()
    };

    #[cfg(target_os = "linux")]
    {
        let _ = build_with_retry(build_fn, 3);
    }
    #[cfg(not(target_os = "linux"))]
    {
        let _ = build_fn().map_err(|e| eprintln!("Failed to open daily digest window: {e}"));
    }
}
