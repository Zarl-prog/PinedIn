pub mod commands;
pub mod db;
pub mod mcp_server;
pub mod notifications;
pub mod scheduler;
pub mod tray;
pub mod window;

use db::DbHandle;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_window_state::StateFlags;

/// Shared flag flipped to `true` when the user explicitly chooses to quit
/// (via the tray menu). The main window's close handler checks this so
/// that the *next* close actually kills the process instead of
/// minimizing to tray. This is what lets the user fully close the app
/// after it's been living in the tray.
#[derive(Default)]
pub struct QuitFlag(pub Arc<AtomicBool>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn is_wayland() -> bool {
    std::env::var("WAYLAND_DISPLAY").is_ok()
        && std::env::var("GDK_BACKEND").unwrap_or_default() != "x11"
}

/// Wait up to 10 seconds for the display server to be ready.
/// On Linux with systemd autostart, PinedIn can launch before the
/// desktop environment is fully initialized, causing WebKit to fail
/// loading the bundled frontend. This check polls for DISPLAY or
/// WAYLAND_DISPLAY before allowing any window creation.
#[cfg(target_os = "linux")]
fn wait_for_display() {
    for i in 0..10 {
        if std::env::var("DISPLAY").is_ok() || std::env::var("WAYLAND_DISPLAY").is_ok() {
            if i > 0 {
                eprintln!("[startup] Display ready after {i}s wait");
            }
            return;
        }
        eprintln!("[startup] Display not ready (attempt {}/10), waiting 1s...", i + 1);
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
    eprintln!("[startup] Display did not become ready after 10s — proceeding anyway");
}

pub fn run() {
    // Set Linux environment variables for X11 compatibility before any windows are created.
    // This ensures always-on-top windows work correctly on Wayland/X11 hybrid setups.
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("GDK_BACKEND", "x11");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        wait_for_display();
    }

    tauri::Builder::default()
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Deny-list the main window: we own its close behaviour
                // (minimize-to-tray), and the plugin's own close handler
                // would otherwise race with ours and destroy the window.
                .with_denylist(&["main"])
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Register the quit flag in app state so the tray menu and
            // the close handler can both reach it.
            let quit_flag = QuitFlag::default();
            app.manage(quit_flag);

            let app_data_dir = match app.path().app_data_dir() {
                Ok(dir) => dir,
                Err(e) => {
                    eprintln!("[startup] Failed to get app data directory: {e}");
                    return Err(Box::from(e));
                }
            };

            let db_handle = match DbHandle::new(app_data_dir) {
                Ok(handle) => Arc::new(handle),
                Err(e) => {
                    eprintln!("[startup] Failed to initialize database: {e}");
                    return Err(Box::from(e));
                }
            };

            app.manage(db_handle.clone());

            // Bind close-to-tray handler if main window exists
            if let Some(main_window) = app.get_webview_window("main") {
                let main_window_clone = main_window.clone();
                let quit_flag_handle = app.state::<QuitFlag>().0.clone();
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        if quit_flag_handle.load(Ordering::SeqCst) {
                            return;
                        }
                        api.prevent_close();
                        if main_window_clone.is_visible().unwrap_or(false) {
                            let _ = main_window_clone.hide();
                        }
                    }
                });

                // Force remove native decorations
                let _ = main_window.set_decorations(false);
                #[cfg(target_os = "windows")]
                {
                    let _ = main_window.hide();
                    let _ = main_window.show();
                }

                // Retry: if WebKit fails to load the bundled frontend on
                // first attempt (race with system init on Linux autostart),
                // reload the page after 2 seconds as a safety net.
                let retry_window = main_window.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                    let _ = retry_window.eval("window.location.reload();");
                });
            } else {
                eprintln!("[startup] Main window not found — continuing without window operations");
            }

            // Setup system tray — log error but don't crash
            if let Err(e) = tray::setup_tray(app.handle()) {
                eprintln!("[startup] Failed to setup system tray: {e}");
            }

            // ── Wayland detection ────────────────────────────────────
            #[cfg(target_os = "linux")]
            if is_wayland() {
                let shown = db_handle
                    .get_setting("wayland_warning_shown")
                    .unwrap_or_default()
                    .map(|v| v == "true")
                    .unwrap_or(false);
                if !shown {
                    let _ = app.emit("show_wayland_warning", ());
                    let _ = db_handle.update_setting("wayland_warning_shown", "true");
                }
            }

            // ── GNOME tray warning ──────────────────────────────────
            #[cfg(target_os = "linux")]
            if tray::is_gnome() {
                let shown = db_handle
                    .get_setting("gnome_tray_warning_shown")
                    .unwrap_or_default()
                    .map(|v| v == "true")
                    .unwrap_or(false);
                if !shown {
                    let _ = app.emit("show_gnome_tray_warning", ());
                    let _ = db_handle.update_setting("gnome_tray_warning_shown", "true");
                }
            }

            // Check if compact mode was enabled before restart
            let compact_enabled = db_handle
                .get_setting("compact_mode")
                .ok()
                .flatten()
                .map(|v| v == "true")
                .unwrap_or(false);

            // Sync the AtomicBool so spawned threads have the correct value immediately
            commands::COMPACT_MODE.store(compact_enabled, std::sync::atomic::Ordering::SeqCst);

            if compact_enabled {
                // Open the compact pill instead of individual task cards.
                // Do NOT open any task card windows — compact mode replaces them.
                window::open_compact_pill_window(app.handle());
            } else {
                // Open all active task cards (global + workspace tasks, no limit)
                if let Ok(tasks) = db_handle.get_all_active_tasks() {
                    window::open_all_task_cards(app.handle(), &tasks);
                }
            }

            // Request notification permission, then fire notifications for tasks due today
            // and start the hourly background checker
            let _ = app.handle().notification().request_permission();
            notifications::start_notification_checker(app.handle().clone());

            // Start the pre-schedule checker. Wakes every 30s, finds any
            // pre-scheduled tasks whose time has arrived, activates them
            // and spawns a floating card. Also runs once immediately on
            // startup so tasks whose time arrived while the app was
            // closed get caught up.
            scheduler::start_scheduler(app.handle().clone());

            // Register global hotkey: Ctrl+Shift+Space on Windows/Linux,
            // Cmd+Shift+Space on macOS — opens quick-add popup from anywhere.
            // Unregister any stale shortcut from a previously crashed
            // instance first to avoid "already registered" panic.
            let _ = app.global_shortcut().unregister_all();
            #[cfg(target_os = "macos")]
            let modifiers = Modifiers::SUPER | Modifiers::SHIFT;
            #[cfg(not(target_os = "macos"))]
            let modifiers = Modifiers::CONTROL | Modifiers::SHIFT;
            if let Err(e) = app.global_shortcut().on_shortcut(
                Shortcut::new(Some(modifiers), Code::Space),
                |app, _shortcut, _event| {
                    window::open_quick_add_window(app);
                },
            ) {
                eprintln!("[startup] Failed to register global shortcut: {e}");
            }

            // Spawn a background update check on startup - silent unless one is found
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                check_for_updates(handle).await;
            });

            // Start the MCP server so AI agents (Claude Desktop, Cursor, etc.)
            // can add, list, and complete tasks via the Model Context Protocol.
            mcp_server::start(app.handle().clone(), db_handle.clone());

            // Open the daily digest popup 2s after launch, but only if
            // the user has enabled it via the footer toggle.
            let digest_enabled = db_handle
                .get_setting("daily_digest_enabled")
                .ok()
                .flatten()
                .map(|v| v == "true")
                .unwrap_or(false);

            if digest_enabled {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn_blocking(move || {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    window::open_daily_digest_window(&handle);
                });
            }

            // ── First-launch onboarding ─────────────────────────────
            let onboarding_done = db_handle
                .get_setting("onboarding_completed")
                .unwrap_or_default()
                .map(|v| v == "true")
                .unwrap_or(false);

            if !onboarding_done {
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
                    let _ = handle.emit("show_onboarding", ());
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_task,
            commands::get_all_tasks,
            commands::get_incomplete_tasks,
            commands::get_task_by_id,
            commands::update_task,
            commands::delete_task,
            commands::complete_task,
            commands::uncomplete_task,
            commands::snooze_task,
            commands::remind_task,
            commands::enable_autostart,
            commands::disable_autostart,
            commands::is_autostart_enabled,
            commands::get_settings_map,
            commands::get_settings,
            commands::update_setting,
            commands::get_shake_interval,
            commands::set_shake_interval,
            commands::get_shake_enabled,
            commands::set_shake_enabled,
            commands::trigger_task_edit,
            commands::install_update,
            commands::get_daily_digest,
            commands::get_daily_digest_enabled,
            commands::set_daily_digest_enabled,
            commands::open_daily_digest_window,
            commands::fire_time_limit_notification,
            commands::add_presceduled_task,
            commands::get_presceduled_tasks,
            commands::get_workspace_tasks,
            commands::get_all_workspace_tasks,
            commands::close_task_card,
            commands::set_zen_mode,
            commands::get_compact_mode,
            commands::set_compact_mode,
            commands::snap_all_cards_to_grid,
            commands::save_workspace,
            commands::get_workspaces,
            commands::load_workspace,
            commands::delete_workspace,
            commands::activate_workspace,
            commands::deactivate_workspace,
            commands::get_active_workspace_id,
            commands::add_task_to_workspace,
            commands::get_card_position,
            commands::focus_next_card,
            commands::focus_prev_card,
            commands::reassert_window_properties,
            commands::complete_onboarding,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

async fn check_for_updates(app: tauri::AppHandle) {
    use tauri_plugin_updater::UpdaterExt;
    if let Ok(updater) = app.updater() {
        if let Ok(Some(update)) = updater.check().await {
            let _ = app.emit("update_available", update.version.clone());
        }
    }
}

// Suppress unused-import warning when the StateFlags import is dropped.
#[allow(dead_code)]
const _STATE_FLAGS: StateFlags = StateFlags::all();
