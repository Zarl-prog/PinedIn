pub mod commands;
pub mod db;
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
pub fn run() {
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
            } else {
                eprintln!("[startup] Main window not found — continuing without window operations");
            }

            // Setup system tray — log error but don't crash
            if let Err(e) = tray::setup_tray(app.handle()) {
                eprintln!("[startup] Failed to setup system tray: {e}");
            }

            // Check if compact mode was enabled before restart
            let compact_enabled = db_handle
                .get_settings_map()
                .ok()
                .and_then(|map| map.get("compact_mode").cloned())
                .map(|v| v == "true")
                .unwrap_or(false);

            if compact_enabled {
                // Open the compact pill instead of individual task cards
                window::open_compact_pill_window(app.handle());
            } else {
                // Open floating task cards for all incomplete tasks (global + workspace)
                if let Ok(tasks) = db_handle.get_all_incomplete_tasks_global() {
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

            // Open the daily digest popup 2s after launch so the main
            // window has time to render first. Using spawn_blocking with
            // std::thread::sleep avoids pulling in a tokio dep just for
            // a one-shot timer.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                std::thread::sleep(std::time::Duration::from_secs(2));
                window::open_daily_digest_window(&handle);
            });

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
            commands::get_settings,
            commands::update_setting,
            commands::get_shake_interval,
            commands::set_shake_interval,
            commands::trigger_task_edit,
            commands::install_update,
            commands::get_daily_digest,
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
