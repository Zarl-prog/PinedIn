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

/// Debug helper: log if a freshly-built window's actual size doesn't match the
/// requested size. On Linux/GTK the webview's natural size request can force a
/// window larger than the requested inner size, which leaves transparent
/// click-blocking margins around the visible pill/card.
#[cfg(target_os = "linux")]
fn log_size_mismatch(window: &tauri::WebviewWindow, label: &str, want_w: f64, want_h: f64) {
    let Ok(actual) = window.inner_size() else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let actual_logical = (actual.width as f64 / scale, actual.height as f64 / scale);
    if (actual_logical.0 - want_w).abs() > 0.5 || (actual_logical.1 - want_h).abs() > 0.5 {
        eprintln!(
            "[window:{label}] size mismatch: requested {want_w:.0}x{want_h:.0}, got {:.0}x{:.0}",
            actual_logical.0, actual_logical.1
        );
    }
}

// ─── Input shaping (click-through dead zones) ───────────────────────────────
//
// Transparent windows still receive mouse events in the pixels *between* the
// visible pill/card and the OS window rect (rounded corners, capsule ends,
// and tooltip-growth space). We clip each window's native input region to the
// visible shape so those transparent pixels pass clicks through to whatever
// is underneath:
//   • Windows — SetWindowRgn with a per-row region union.
//   • Linux — GTK input_shape_combine_region with a cairo region (works on
//     the X11 backend the app forces; not available on macOS).
//
// Radii are in logical px, matching the frontend border-radius of each shape.
// Unknown labels (e.g. the main window) get None and are left untouched.

fn window_radii(label: &str, logical_h: f64) -> Option<[f64; 4]> {
    if label == "edge_peek" {
        return Some([28.0, 0.0, 0.0, 28.0]);
    }
    if label == "compact_pill" {
        // Collapsed 36px-high capsule rounds to r=18; expanded 120px panel is r=16.
        return Some(if logical_h <= 36.0 { [18.0; 4] } else { [16.0; 4] });
    }
    if label.starts_with("task_") {
        return Some([12.0; 4]);
    }
    if label == "quick_add" {
        return Some([14.0; 4]);
    }
    None
}

/// For each pixel row of an `w×h` window, the inclusive-input x-range
/// `(x0, x1)` of a rounded rectangle with corner radii tl/tr/br/bl.
/// Rows where the shape is empty are omitted.
fn rounded_rect_rows(w: i32, h: i32, tl: f64, tr: f64, br: f64, bl: f64) -> Vec<(i32, i32)> {
    let mut rows = Vec::with_capacity(h.max(0) as usize);
    for y in 0..h {
        let yf = y as f64;
        let dyb = (h - y) as f64;

        let mut x0 = 0.0f64;
        if tl > 0.0 && yf < tl {
            let d = 2.0 * tl * yf - yf * yf;
            x0 = x0.max(tl - if d > 0.0 { d.sqrt() } else { tl });
        }
        if bl > 0.0 && dyb <= bl {
            let d = 2.0 * bl * dyb - dyb * dyb;
            x0 = x0.max(bl - if d > 0.0 { d.sqrt() } else { bl });
        }

        let mut x1 = w as f64;
        if tr > 0.0 && yf < tr {
            let d = 2.0 * tr * yf - yf * yf;
            x1 = x1.min(w as f64 - (tr - if d > 0.0 { d.sqrt() } else { tr }));
        }
        if br > 0.0 && dyb <= br {
            let d = 2.0 * br * dyb - dyb * dyb;
            x1 = x1.min(w as f64 - (br - if d > 0.0 { d.sqrt() } else { br }));
        }

        let ix0 = x0.ceil() as i32;
        let ix1 = x1.floor() as i32;
        if ix1 > ix0 {
            rows.push((ix0, ix1));
        }
    }
    rows
}

#[cfg(target_os = "windows")]
fn apply_shape_windows(window: &tauri::WebviewWindow, rows: &[(i32, i32)]) {
    use windows::Win32::Graphics::Gdi::{
        CombineRgn, CreateRectRgn, DeleteObject, HGDIOBJ, HRGN, RGN_OR,
    };
    use windows::Win32::UI::WindowsAndMessaging::SetWindowRgn;

    let Ok(hwnd) = window.hwnd() else {
        return;
    };
    let hwnd: windows::Win32::Foundation::HWND = hwnd;

    unsafe {
        let dst = CreateRectRgn(0, 0, 0, 0);
        if dst.0.is_null() {
            return;
        }
        for (y, &(x0, x1)) in rows.iter().enumerate() {
            let row = CreateRectRgn(x0, y as i32, x1, y as i32 + 1);
            if row.0.is_null() {
                continue;
            }
            let _ = CombineRgn(Some(dst), Some(dst), Some(row), RGN_OR);
            let _ = DeleteObject(HGDIOBJ(row.0));
        }
        // The system owns the region on success — don't delete it then.
        let ok = SetWindowRgn(hwnd, Some(dst), true);
        if ok == 0 {
            let _ = DeleteObject(HGDIOBJ(dst.0));
        }
    }
}

#[cfg(target_os = "linux")]
fn apply_shape_linux(window: &tauri::WebviewWindow, rows: &[(i32, i32)]) {
    use gtk::prelude::WidgetExt;

    fn shape_region(rows: &[(i32, i32)]) -> gtk::cairo::Region {
        let region = gtk::cairo::Region::create_rectangle(&gtk::cairo::RectangleInt::new(
            0, 0, 1, 1,
        ));
        for (y, &(x0, x1)) in rows.iter().enumerate() {
            let _ = region.union_rectangle(&gtk::cairo::RectangleInt::new(
                x0,
                y as i32,
                (x1 - x0).max(1),
                1,
            ));
        }
        region
    }

    fn apply(win: &tauri::WebviewWindow, rows: &[(i32, i32)]) {
        let Ok(gtk_window) = win.gtk_window() else {
            return;
        };
        gtk_window.input_shape_combine_region(Some(&shape_region(rows)));
    }

    // Run on the GTK main thread. The first pass may run before the GdkWindow
    // is realized (input shape on an unrealized widget is a silent no-op), so
    // a second pass after the window has been shown settles the shape.
    let _ = window.run_on_main_thread({
        let win = window.clone();
        let rows = rows.to_vec();
        move || apply(&win, &rows)
    });
    let win2 = window.clone();
    let rows2 = rows.to_vec();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(200));
        let win3 = win2.clone();
        let _ = win2.run_on_main_thread(move || apply(&win3, &rows2));
    });
}

/// Clip the window's native input region to its visible rounded shape.
/// No-op on macOS and for labels without a known shape.
pub fn apply_window_shape(app: &AppHandle, label: &str) {
    let Some(window) = app.get_webview_window(label) else {
        return;
    };
    apply_window_shape_to(&window);
}

fn apply_window_shape_to(window: &tauri::WebviewWindow) {
    #[cfg(any(target_os = "windows", target_os = "linux"))]
    {
        let Ok(size) = window.inner_size() else {
            return;
        };
        let scale = window.scale_factor().unwrap_or(1.0);
        let logical_h = size.height as f64 / scale;
        let Some(radii) = window_radii(&window.label(), logical_h) else {
            return;
        };
        let rows = rounded_rect_rows(
            size.width.max(1) as i32,
            size.height.max(1) as i32,
            radii[0] * scale,
            radii[1] * scale,
            radii[2] * scale,
            radii[3] * scale,
        );

        #[cfg(target_os = "windows")]
        apply_shape_windows(window, &rows);

        #[cfg(target_os = "linux")]
        apply_shape_linux(window, &rows);
    }
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

    #[cfg(target_os = "linux")]
    log_size_mismatch(&window, &label, CARD_WIDTH, CARD_HEIGHT);

    apply_window_shape(app, &label);

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

    apply_window_shape(app, &label);

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

    apply_window_shape(app, label);

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
    log_size_mismatch(&_window, label, 100.0, 36.0);

    #[cfg(target_os = "linux")]
    let _ = _window.set_always_on_top(true);

    apply_window_shape(app, label);
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
fn edge_peek_geometry(sw: f64, sh: f64, expanded: bool) -> (f64, f64, f64, f64) {
    let (w, h) = if expanded {
        (EDGE_PEEK_EXPANDED_W, EDGE_PEEK_EXPANDED_H)
    } else {
        (EDGE_PEEK_TAB_W, EDGE_PEEK_TAB_H)
    };
    let x = (sw - w).max(0.0);
    let max_y = (sh - h).max(0.0);
    let y = EDGE_PEEK_TOP_OFFSET.clamp(0.0, max_y);
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
    let (x, y, w, h) = edge_peek_geometry(sw, sh, expanded);

    // Always update Tauri's internal state first — this is the source of truth
    // for the webview bounds cache. Without it WebView2 content layout desyncs
    // from the native window on Windows (B1).
    let gen = bump_edge_peek_gen();
    let _ = window.set_size(Size::Logical(LogicalSize::new(w, h)));
    let _ = window.set_position(Position::Logical(LogicalPosition::new(x, y)));

    // Re-clip the input region to the new pill/strip geometry.
    apply_window_shape_to(window);

    #[cfg(target_os = "windows")]
    {
        // Reinforce with the native API so the OS sees the change immediately,
        // but never bypass Tauri's internal state (B1). Use SWP_ASYNCWINDOWPOS
        // because commands run on tokio threads, not the UI thread — a
        // synchronous SetWindowPos could deadlock (B2).
        if let Ok(hwnd) = window.hwnd() {
            let hwnd: windows::Win32::Foundation::HWND = hwnd;
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
        let (x, y, w, h) = edge_peek_geometry(sw, sh, expanded);

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

        match &result {
            Ok(win) => {
                #[cfg(target_os = "linux")]
                log_size_mismatch(win, label, w, h);
                apply_window_shape(app, label);
            }
            Err(e) => eprintln!("Failed to open edge peek window: {e}"),
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

// ─── Tooltip Window ──────────────────────────────────────────────────────────

pub const TOOLTIP_W: f64 = 260.0;
pub const TOOLTIP_H: f64 = 120.0;

/// Create the shared, always-on-top, fully click-through tooltip popup.
/// Built hidden and sized/positioned on demand by `show_tooltip`; content is
/// pushed to it via the "tooltip-content" event. One instance serves every
/// overlay window, so tooltips never make the owner window grow (which is
/// what used to leave large transparent click-blocking margins around the
/// pill and edge-peek strip).
pub fn ensure_tooltip_window(app: &AppHandle) -> Result<(), String> {
    let label = "tooltip";
    if app.get_webview_window(label).is_some() {
        return Ok(());
    }

    let build_fn = || {
        WebviewWindowBuilder::new(app, label, WebviewUrl::App("tooltip.html".into()))
            .inner_size(TOOLTIP_W, TOOLTIP_H)
            .resizable(false)
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .focused(false)
            .visible(false)
            .position(0.0, 0.0)
            .build()
    };

    #[cfg(target_os = "linux")]
    let result = build_with_retry(build_fn, 3);
    #[cfg(not(target_os = "linux"))]
    let result = build_fn();

    let window = result.map_err(|e| format!("Failed to create tooltip window: {e}"))?;
    window
        .set_ignore_cursor_events(true)
        .map_err(|e| format!("Failed to make tooltip window click-through: {e}"))?;
    Ok(())
}
