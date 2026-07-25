#![recursion_limit = "256"]

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
use tauri::{Emitter, Manager, RunEvent};
use tauri::utils::config::Color;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_single_instance::init as single_instance_init;
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_window_state::StateFlags;

/// Shared flag flipped to `true` when the user explicitly chooses to quit
/// (via the tray menu). The main window's close handler checks this so
/// that the *next* close actually kills the process instead of
/// minimizing to tray. This is what lets the user fully close the app
/// after it's been living in the tray.
#[derive(Default)]
pub struct QuitFlag(pub Arc<AtomicBool>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
/// Set WebKit environment variables required for Linux compatibility.
/// These prevent compositing and dmabuf issues that cause WebView
/// creation failures, particularly on Fedora and other modern distros.
pub fn set_linux_webkit_env() {
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        std::env::set_var("WEBKIT_FORCE_SANDBOX", "0");
    }
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
    // Force X11 backend on Linux so global shortcuts and transparent
    // windows work reliably (Wayland's security model blocks both).
    #[cfg(target_os = "linux")]
    {
        std::env::set_var("GDK_BACKEND", "x11");
        std::env::set_var("WEBKIT_DISABLE_COMPOSITING_MODE", "1");
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        wait_for_display();
    }

    tauri::Builder::default()
        .plugin(single_instance_init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Deny-list windows we position programmatically: the plugin
                // would otherwise save/restore their geometry from the
                // registry and race with our own positioning on startup.
                .with_denylist(&["main", "quick_add", "edge_peek", "compact_pill", "daily_digest"])
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            set_linux_webkit_env();

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

                #[cfg(target_os = "linux")]
                {
                    // Transparent background + CSS border-radius on the root
                    // div creates the appearance of rounded corners through
                    // transparency clipping. On KDE/GNOME with compositing
                    // this looks clean; on bare X11 it gracefully degrades.
                    let _ = main_window.set_background_color(Some(Color(0, 0, 0, 0)));
                }
                #[cfg(not(target_os = "linux"))]
                {
                    let _ = main_window.set_background_color(Some(Color(0, 0, 0, 255)));
                }

                #[cfg(target_os = "windows")]
                {
                    let _ = main_window.hide();
                    let _ = main_window.show();
                    // Request rounded corners via DWM on Windows 11.
                    // Windows 10 ignores this gracefully.
                    if let Ok(hwnd) = main_window.hwnd() {
                        let pref: u32 = 2; // DWMWCP_ROUND (small round)
                        unsafe {
                            let _ = windows::Win32::UI::Controls::DwmSetWindowAttribute(
                                hwnd,
                                windows::Win32::UI::Controls::DWMWA_WINDOW_CORNER_PREFERENCE,
                                &pref as *const _ as *const std::ffi::c_void,
                                std::mem::size_of::<u32>() as u32,
                            );
                        }
                    }
                }

                // Retry: if WebKit failed to load the bundled frontend on
                // the first attempt (race with system init on Linux autostart),
                // reload only if the page body is still empty after 3 seconds.
                let retry_window = main_window.clone();
                tauri::async_runtime::spawn(async move {
                    tokio::time::sleep(std::time::Duration::from_secs(3)).await;
                    let _ = retry_window.eval(
                        "if (!document.body || !document.body.children.length) window.location.reload();"
                    );
                });
            } else {
                eprintln!("[startup] Main window not found — continuing without window operations");
            }

            // Setup system tray — log error but don't crash
            if let Err(e) = tray::setup_tray(app.handle()) {
                eprintln!("[startup] Failed to setup system tray: {e}");
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

            // Check edge peek enabled and compact mode
            let edge_peek_enabled = db_handle
                .get_setting("edge_peek_enabled")
                .ok()
                .flatten()
                .map(|v| v == "true")
                .unwrap_or(false);

            let compact_enabled = db_handle
                .get_setting("compact_mode")
                .ok()
                .flatten()
                .map(|v| v == "true")
                .unwrap_or(false);

            commands::COMPACT_MODE.store(compact_enabled, std::sync::atomic::Ordering::SeqCst);
            commands::EDGE_PEEK_ENABLED.store(edge_peek_enabled, std::sync::atomic::Ordering::SeqCst);

            // Restore persisted Y position so the pill opens where the
            // user last left it.
            if let Ok(Some(y_str)) = db_handle.get_setting("edge_peek_y") {
                if let Ok(y) = y_str.parse::<f64>() {
                    window::set_anchor_center_y(y.max(0.0));
                }
            }

            // Only open edge peek if enabled AND there are incomplete tasks
            if edge_peek_enabled {
                if let Ok(tasks) = db_handle.get_incomplete_tasks() {
                    if !tasks.is_empty() {
                        // Check persisted expanded state
                        let expanded = db_handle
                            .get_setting("edge_peek_expanded")
                            .ok()
                            .flatten()
                            .map(|v| v == "true")
                            .unwrap_or(false);
                        window::open_edge_peek_window(app.handle(), expanded);
                    }
                }
            }

            if compact_enabled {
                window::open_compact_pill_window(app.handle());
            } else if !edge_peek_enabled {
                // Only open task cards if neither compact nor edge peek mode
                if let Ok(tasks) = db_handle.get_all_active_tasks() {
                    window::open_all_task_cards(app.handle(), &tasks);
                }
            }

            // Fire notifications for tasks due today and start the hourly background checker
            notifications::start_notification_checker(app.handle().clone());

            // Start the pre-schedule checker. Wakes every 30s, finds any
            // pre-scheduled tasks whose time has arrived, activates them
            // and spawns a floating card. Also runs once immediately on
            // startup so tasks whose time arrived while the app was
            // closed get caught up.
            scheduler::start_scheduler(app.handle().clone());

            // Register global hotkey: Ctrl+Shift+Space — opens quick-add popup
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

            // Register global hotkey: Ctrl+Shift+E — toggles edge peek
            #[cfg(target_os = "macos")]
            let edge_peek_modifiers = Modifiers::SUPER | Modifiers::SHIFT;
            #[cfg(not(target_os = "macos"))]
            let edge_peek_modifiers = Modifiers::CONTROL | Modifiers::SHIFT;
            if let Err(e) = app.global_shortcut().on_shortcut(
                Shortcut::new(Some(edge_peek_modifiers), Code::KeyE),
                |app, _shortcut, _event| {
                    commands::toggle_edge_peek_from_shortcut(app);
                },
            ) {
                eprintln!("[startup] Failed to register edge peek shortcut: {e}");
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
            commands::quick_add_task,
            commands::get_all_tasks,
            commands::get_incomplete_tasks,
            commands::get_task_by_id,
            commands::update_task,
            commands::delete_task,
            commands::complete_task,
            commands::uncomplete_task,
            commands::snooze_task,
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
            commands::get_edge_peek_enabled,
            commands::set_edge_peek_enabled,
            commands::toggle_edge_peek,
            commands::expand_edge_peek,
            commands::collapse_edge_peek,
            commands::get_edge_peek_expanded,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::ExitRequested { api, .. } = event {
                let quit_flag = app_handle.state::<QuitFlag>();
                if !quit_flag.0.load(std::sync::atomic::Ordering::SeqCst) {
                    api.prevent_exit();
                }
            }
        });
}

async fn check_for_updates(app: tauri::AppHandle) {
    use tauri_plugin_updater::UpdaterExt;
    match app.updater() {
        Ok(updater) => match updater.check().await {
            Ok(Some(update)) => {
                eprintln!("[updater] Update available: v{}", update.version);
                let _ = app.emit("update_available", update.version.clone());
            }
            Ok(None) => eprintln!("[updater] No update available"),
            Err(e) => eprintln!("[updater] Check failed: {e}"),
        },
        Err(e) => eprintln!("[updater] Updater not available: {e}"),
    }
}

// Suppress unused-import warning when the StateFlags import is dropped.
#[allow(dead_code)]
const _STATE_FLAGS: StateFlags = StateFlags::all();
