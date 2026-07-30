use crate::commands;
use crate::db::DbHandle;
use crate::window;
use axum::{
    extract::State,
    http::StatusCode,
    response::sse::{Event, Sse},
    routing::{get, post},
    Json, Router,
};
use serde_json::{json, Value};
use std::convert::Infallible;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;
use tokio::sync::broadcast;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;

const MCP_PORT: u16 = 7890;

#[derive(Clone)]
pub struct McpState {
    app_handle: AppHandle,
    db: Arc<DbHandle>,
    tx: broadcast::Sender<String>,
}

pub fn start(app_handle: AppHandle, db: Arc<DbHandle>) {
    let (tx, _) = broadcast::channel(64);
    let state = McpState {
        app_handle,
        db,
        tx: tx.clone(),
    };

    tauri::async_runtime::spawn(async move {
        let app = Router::new()
            .route("/sse", get(sse_handler))
            .route("/message", post(message_handler))
            .with_state(state);

        let addr = format!("127.0.0.1:{}", MCP_PORT);
        println!("Pinned MCP server running on http://{}/sse", addr);

        match tokio::net::TcpListener::bind(&addr).await {
            Ok(listener) => {
                if let Err(e) = axum::serve(listener, app).await {
                    eprintln!("MCP server error: {e}");
                }
            }
            Err(e) => {
                eprintln!("Failed to bind MCP server on {}: {e}", addr);
            }
        }
    });
}

async fn sse_handler(
    State(state): State<McpState>,
) -> Sse<impl tokio_stream::Stream<Item = Result<Event, Infallible>>> {
    let rx = state.tx.subscribe();
    let stream = BroadcastStream::new(rx).filter_map(|msg| match msg {
        Ok(data) => Some(Ok(Event::default().data(data))),
        Err(_) => None,
    });
    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(std::time::Duration::from_secs(15))
            .text("keep-alive"),
    )
}

async fn message_handler(
    State(state): State<McpState>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let method = body
        .get("method")
        .and_then(|m| m.as_str())
        .unwrap_or("");
    let id = body.get("id").cloned();

    let result = match method {
        "initialize" => handle_initialize(&id),
        "tools/list" => handle_tools_list(&id),
        "tools/call" => {
            let params = body.get("params").and_then(|p| p.as_object()).cloned();
            // Run tool calls on a blocking thread to avoid starving the
            // tokio runtime with synchronous rusqlite DB operations.
            let state_clone = state.clone();
            let id_clone = id.clone();
            tokio::task::spawn_blocking(move || {
                handle_tool_call(&id_clone, params, &state_clone)
            })
            .await
            .map_err(|e| {
                eprintln!("[mcp] Tool call panicked: {e}");
                StatusCode::INTERNAL_SERVER_ERROR
            })?
        }
        "notifications/initialized" => Ok(None),
        _ => Ok(Some(json!({
            "jsonrpc": "2.0",
            "id": id.clone(),
            "error": { "code": -32601, "message": format!("Method not found: {}", method) }
        }))),
    };

    match result {
        Ok(Some(response)) => {
            let data = response.to_string();
            let _ = state.tx.send(data.clone());
            // Return the response in the HTTP body as well
            Ok(Json(response))
        }
        Ok(None) => Ok(Json(json!({ "jsonrpc": "2.0", "id": id }))),
        Err(status) => Err(status),
    }
}

fn handle_initialize(id: &Option<Value>) -> Result<Option<Value>, StatusCode> {
    Ok(Some(json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": {
            "protocolVersion": "2024-11-05",
            "capabilities": {
                "tools": {}
            },
            "serverInfo": {
                "name": "pinedin",
                "version": env!("CARGO_PKG_VERSION")
            }
        }
    })))
}

fn handle_tools_list(id: &Option<Value>) -> Result<Option<Value>, StatusCode> {
    Ok(Some(json!({
        "jsonrpc": "2.0",
        "id": id,
        "result": {
            "tools": [
                {
                    "name": "add_task",
                    "description": "Add a new task to Pinned. The task will appear as a floating card on the user's screen immediately.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "title": {
                                "type": "string",
                                "description": "The title of the task"
                            },
                            "description": {
                                "type": "string",
                                "description": "Optional description for the task"
                            },
                            "due_date": {
                                "type": "string",
                                "description": "Due date in YYYY-MM-DD format"
                            },
                            "workspace_id": {
                                "type": "number",
                                "description": "Optional workspace ID to add the task to"
                            }
                        },
                        "required": ["title"]
                    }
                },
                {
                    "name": "list_tasks",
                    "description": "List all active (incomplete) tasks in Pinned",
                    "inputSchema": {
                        "type": "object",
                        "properties": {}
                    }
                },
                {
                    "name": "complete_task",
                    "description": "Mark a task as complete by its ID",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "task_id": {
                                "type": "number",
                                "description": "The ID of the task to complete"
                            }
                        },
                        "required": ["task_id"]
                    }
                },
                {
                    "name": "add_multiple_tasks",
                    "description": "Add multiple tasks at once, useful for bulk import from meeting notes or lists",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "titles": {
                                "type": "array",
                                "items": { "type": "string" },
                                "description": "List of task titles to add"
                            }
                        },
                        "required": ["titles"]
                    }
                },
                {
                    "name": "update_task",
                    "description": "Edit an existing task's title, description, due date, or other fields",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "task_id": { "type": "number", "description": "The ID of the task to update" },
                            "title": { "type": "string", "description": "New title" },
                            "description": { "type": "string", "description": "New description" },
                            "due_date": { "type": "string", "description": "New due date in YYYY-MM-DD format" }
                        },
                        "required": ["task_id"]
                    }
                },
                {
                    "name": "delete_task",
                    "description": "Permanently delete a task by its ID",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "task_id": { "type": "number", "description": "The ID of the task to delete" }
                        },
                        "required": ["task_id"]
                    }
                },
                {
                    "name": "list_all_tasks",
                    "description": "List all tasks including completed ones",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "get_task_by_id",
                    "description": "Get detailed information about a single task",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "task_id": { "type": "number", "description": "The ID of the task" }
                        },
                        "required": ["task_id"]
                    }
                },
                {
                    "name": "create_workspace",
                    "description": "Create a new workspace to organize tasks",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "name": { "type": "string", "description": "The name of the workspace" }
                        },
                        "required": ["name"]
                    }
                },
                {
                    "name": "list_workspaces",
                    "description": "List all workspaces",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "delete_workspace",
                    "description": "Delete a workspace and all its tasks",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "workspace_id": { "type": "number", "description": "The ID of the workspace to delete" }
                        },
                        "required": ["workspace_id"]
                    }
                },
                {
                    "name": "get_workspace_tasks",
                    "description": "Get all tasks in a workspace",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "workspace_id": { "type": "number", "description": "The workspace ID" }
                        },
                        "required": ["workspace_id"]
                    }
                },
                {
                    "name": "snooze_task",
                    "description": "Snooze a task for a given number of minutes (hides its floating card temporarily)",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "task_id": { "type": "number", "description": "The ID of the task to snooze" },
                            "minutes": { "type": "number", "description": "Number of minutes to snooze" }
                        },
                        "required": ["task_id", "minutes"]
                    }
                },
                {
                    "name": "update_setting",
                    "description": "Change any Pinned setting by key/value pair (e.g. compact_mode, daily_digest_enabled)",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "key": { "type": "string", "description": "Setting key (e.g. compact_mode, shake_enabled)" },
                            "value": { "type": "string", "description": "Setting value (e.g. true, false)" }
                        },
                        "required": ["key", "value"]
                    }
                },
                {
                    "name": "activate_workspace",
                    "description": "Switch the view to show only tasks from a specific workspace",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "workspace_id": { "type": "number", "description": "The workspace ID to activate" }
                        },
                        "required": ["workspace_id"]
                    }
                },
                {
                    "name": "deactivate_workspace",
                    "description": "Show tasks from all workspaces again",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "align_tasks",
                    "description": "Snap all floating task cards into a clean grid arrangement",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "uncomplete_task",
                    "description": "Re-open a completed task and put its floating card back",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "task_id": { "type": "number", "description": "The ID of the task to uncomplete" }
                        },
                        "required": ["task_id"]
                    }
                },
                {
                    "name": "get_settings",
                    "description": "Get all Pinned settings as key/value pairs",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "get_shake_interval",
                    "description": "Get the urgency shake interval in seconds",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "set_shake_interval",
                    "description": "Set the urgency shake interval in seconds",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "seconds": { "type": "number", "description": "Shake interval in seconds" }
                        },
                        "required": ["seconds"]
                    }
                },
                {
                    "name": "get_shake_enabled",
                    "description": "Check if urgency shake is enabled",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "set_shake_enabled",
                    "description": "Enable or disable urgency shake",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "enabled": { "type": "boolean", "description": "Whether shake is enabled" }
                        },
                        "required": ["enabled"]
                    }
                },
                {
                    "name": "get_daily_digest",
                    "description": "Get daily digest counts (overdue, due today, etc.)",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "load_workspace",
                    "description": "Restore a saved workspace by ID (closes current cards, opens saved ones)",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "workspace_id": { "type": "number", "description": "The workspace ID to load" }
                        },
                        "required": ["workspace_id"]
                    }
                },
                {
                    "name": "save_workspace",
                    "description": "Save current card positions as a named workspace (captures positions of all open cards)",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "name": { "type": "string", "description": "Name for the workspace" }
                        },
                        "required": ["name"]
                    }
                },
                {
                    "name": "add_task_to_workspace",
                    "description": "Assign an existing task to a workspace",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "task_id": { "type": "number", "description": "The task ID" },
                            "workspace_id": { "type": "number", "description": "The workspace ID" }
                        },
                        "required": ["task_id", "workspace_id"]
                    }
                },
                {
                    "name": "get_active_workspace_id",
                    "description": "Get the currently active workspace ID (or none if showing all)",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "set_zen_mode",
                    "description": "Hide or show all floating task cards (zen mode)",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "hidden": { "type": "boolean", "description": "True to hide cards, false to show them" }
                        },
                        "required": ["hidden"]
                    }
                },
                {
                    "name": "add_presceduled_task",
                    "description": "Schedule a task to appear at a future date/time",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "title": { "type": "string", "description": "The task title" },
                            "scheduled_at": { "type": "string", "description": "ISO 8601 datetime when the task should appear (e.g. 2026-07-08T14:00:00Z)" },
                            "description": { "type": "string", "description": "Optional description" },
                            "due_date": { "type": "string", "description": "Optional due date in YYYY-MM-DD format" }
                        },
                        "required": ["title", "scheduled_at"]
                    }
                },
                {
                    "name": "get_presceduled_tasks",
                    "description": "List all pending pre-scheduled tasks",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "get_card_position",
                    "description": "Get the position index and total count of a task card among all open cards",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "task_id": { "type": "number", "description": "The task ID" }
                        },
                        "required": ["task_id"]
                    }
                },
                {
                    "name": "focus_next_card",
                    "description": "Focus the next task card window in the stack",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "task_id": { "type": "number", "description": "The current task ID to navigate from" }
                        },
                        "required": ["task_id"]
                    }
                },
                {
                    "name": "focus_prev_card",
                    "description": "Focus the previous task card window in the stack",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "task_id": { "type": "number", "description": "The current task ID to navigate from" }
                        },
                        "required": ["task_id"]
                    }
                },
                {
                    "name": "get_autostart_state",
                    "description": "Check if autostart is enabled",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "set_autostart",
                    "description": "Enable or disable autostart on login",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "enabled": { "type": "boolean", "description": "Whether to autostart on login" }
                        },
                        "required": ["enabled"]
                    }
                }
            ]
        }
    })))
}

fn handle_tool_call(
    id: &Option<Value>,
    params: Option<serde_json::Map<String, Value>>,
    state: &McpState,
) -> Result<Option<Value>, StatusCode> {
    let params = params.unwrap_or_default();
    let name = params
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let arguments = params
        .get("arguments")
        .and_then(|v| v.as_object())
        .cloned()
        .unwrap_or_default();

    let result = match name.as_str() {
        "add_task" => tool_add_task(arguments, state),
        "list_tasks" => tool_list_tasks(state),
        "complete_task" => tool_complete_task(arguments, state),
        "add_multiple_tasks" => tool_add_multiple_tasks(arguments, state),
        "update_task" => tool_update_task(arguments, state),
        "delete_task" => tool_delete_task(arguments, state),
        "list_all_tasks" => tool_list_all_tasks(state),
        "get_task_by_id" => tool_get_task_by_id(arguments, state),
        "create_workspace" => tool_create_workspace(arguments, state),
        "list_workspaces" => tool_list_workspaces(state),
        "delete_workspace" => tool_delete_workspace(arguments, state),
        "get_workspace_tasks" => tool_get_workspace_tasks(arguments, state),
        "snooze_task" => tool_snooze_task(arguments, state),
        "update_setting" => tool_update_setting(arguments, state),
        "activate_workspace" => tool_activate_workspace(arguments, state),
        "deactivate_workspace" => tool_deactivate_workspace(state),
        "align_tasks" => tool_align_tasks(state),
        "uncomplete_task" => tool_uncomplete_task(arguments, state),
        "get_settings" => tool_get_settings(state),
        "get_shake_interval" => tool_get_shake_interval(state),
        "set_shake_interval" => tool_set_shake_interval(arguments, state),
        "get_shake_enabled" => tool_get_shake_enabled(state),
        "set_shake_enabled" => tool_set_shake_enabled(arguments, state),
        "get_daily_digest" => tool_get_daily_digest(state),
        "load_workspace" => tool_load_workspace(arguments, state),
        "save_workspace" => tool_save_workspace(arguments, state),
        "add_task_to_workspace" => tool_add_task_to_workspace(arguments, state),
        "get_active_workspace_id" => tool_get_active_workspace_id(state),
        "set_zen_mode" => tool_set_zen_mode(arguments, state),
        "add_presceduled_task" => tool_add_presceduled_task(arguments, state),
        "get_presceduled_tasks" => tool_get_presceduled_tasks(state),
        "get_card_position" => tool_get_card_position(arguments, state),
        "focus_next_card" => tool_focus_next_card(arguments, state),
        "focus_prev_card" => tool_focus_prev_card(arguments, state),
        "get_autostart_state" => tool_get_autostart_state(state),
        "set_autostart" => tool_set_autostart(arguments, state),
        _ => return Ok(Some(json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32602, "message": format!("Unknown tool: {}", name) }
        }))),
    };

    match result {
        Ok(content) => Ok(Some(json!({
            "jsonrpc": "2.0",
            "id": id,
            "result": {
                "content": [{
                    "type": "text",
                    "text": content
                }]
            }
        }))),
        Err(e) => Ok(Some(json!({
            "jsonrpc": "2.0",
            "id": id,
            "error": { "code": -32000, "message": e }
        }))),
    }
}

fn tool_add_task(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let title = arguments
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing required argument: title".to_string())?
        .to_string();

    let description = arguments
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let due_date = arguments
        .get("due_date")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_default();

    let workspace_id = arguments
        .get("workspace_id")
        .and_then(|v| v.as_i64());

    let task = state
        .db
        .create_task_with_tags(&title, &description, &due_date, None, None, None, workspace_id)?;

    if let Some(task_id) = task.id {
        let _ = window::open_task_card(&state.app_handle, &task, 0);
        commands::emit_tasks_updated(&state.app_handle, &state.db);
        Ok(format!(
            "Task '{}' added successfully with ID {}. It is now floating on the user's screen.",
            title, task_id
        ))
    } else {
        Ok(format!("Task '{}' added successfully.", title))
    }
}

fn tool_list_tasks(state: &McpState) -> Result<String, String> {
    let tasks = state.db.get_all_active_tasks()?;

    if tasks.is_empty() {
        return Ok("No active tasks.".to_string());
    }

    let lines: Vec<String> = tasks
        .iter()
        .map(|t| {
            format!(
                "- {} (due: {})",
                t.title,
                if t.due_time.is_empty() {
                    "no date".to_string()
                } else {
                    t.due_time.clone()
                }
            )
        })
        .collect();

    Ok(lines.join("\n"))
}

fn tool_complete_task(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let task_id = arguments
        .get("task_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: task_id".to_string())?;

    state.db.complete_task(task_id)?;
    window::close_task_card(&state.app_handle, task_id);
    commands::emit_tasks_updated(&state.app_handle, &state.db);

    Ok(format!("Task {} marked as complete.", task_id))
}

fn tool_add_multiple_tasks(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let titles: Vec<String> = arguments
        .get("titles")
        .and_then(|v| v.as_array())
        .ok_or_else(|| "Missing required argument: titles".to_string())?
        .iter()
        .filter_map(|v| v.as_str().map(String::from))
        .collect();

    if titles.is_empty() {
        return Err("No titles provided.".to_string());
    }

    let mut added: Vec<String> = Vec::new();

    for title in &titles {
        match state.db.create_task_with_tags(
            title,
            "",
            "",
            None,
            None,
            None,
            None,
        ) {
            Ok(task) => {
                if let Some(_task_id) = task.id {
                    let _ = window::open_task_card(&state.app_handle, &task, 0);
                    added.push(title.clone());
                }
            }
            Err(e) => {
                eprintln!("Failed to add task '{}': {}", title, e);
            }
        }
    }

    commands::emit_tasks_updated(&state.app_handle, &state.db);

    Ok(format!(
        "Added {} tasks: {}",
        added.len(),
        added.join(", ")
    ))
}

fn tool_update_task(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let task_id = arguments
        .get("task_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: task_id".to_string())?;

    let existing = state.db.get_task_by_id(task_id)?;

    let title = arguments
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or(&existing.title);
    let description = arguments
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or(&existing.description);
    let due_time = arguments
        .get("due_date")
        .and_then(|v| v.as_str())
        .unwrap_or(&existing.due_time);

    state.db.update_task(
        task_id,
        title,
        description,
        due_time,
        None,
        None,
        None,
        None,
    )?;

    commands::emit_tasks_updated(&state.app_handle, &state.db);
    Ok(format!("Task {} updated successfully.", task_id))
}

fn tool_delete_task(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let task_id = arguments
        .get("task_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: task_id".to_string())?;

    state.db.delete_task(task_id)?;
    window::close_task_card(&state.app_handle, task_id);
    commands::emit_tasks_updated(&state.app_handle, &state.db);
    Ok(format!("Task {} deleted.", task_id))
}

fn tool_list_all_tasks(state: &McpState) -> Result<String, String> {
    let tasks = state.db.get_all_tasks()?;
    if tasks.is_empty() {
        return Ok("No tasks.".to_string());
    }
    let lines: Vec<String> = tasks
        .iter()
        .map(|t| {
            let status = if t.completed { "[done]" } else { "[active]" };
            let id = t.id.unwrap_or(0);
            format!(
                "{} #{} {} (due: {})",
                status, id, t.title,
                if t.due_time.is_empty() { "no date" } else { &t.due_time }
            )
        })
        .collect();
    Ok(lines.join("\n"))
}

fn tool_get_task_by_id(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let task_id = arguments
        .get("task_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: task_id".to_string())?;

    let task = state.db.get_task_by_id(task_id)?;
    let id = task.id.unwrap_or(0);
    let ws = task.workspace_id.map(|id| id.to_string()).unwrap_or_else(|| "none".to_string());
    Ok(format!(
        "ID: {}\nTitle: {}\nDescription: {}\nDue: {}\nCompleted: {}\nWorkspace: {}",
        id,
        task.title,
        task.description,
        if task.due_time.is_empty() { "none" } else { &task.due_time },
        if task.completed { "yes" } else { "no" },
        ws
    ))
}

fn tool_create_workspace(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let name = arguments
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing required argument: name".to_string())?
        .to_string();

    let id = state.db.save_workspace(&name, "{}")?;
    Ok(format!("Workspace '{}' created with ID {}.", name, id))
}

fn tool_list_workspaces(state: &McpState) -> Result<String, String> {
    let workspaces = state.db.get_all_workspaces()?;
    if workspaces.is_empty() {
        return Ok("No workspaces.".to_string());
    }
    let lines: Vec<String> = workspaces
        .iter()
        .map(|w| format!("- #{} {}", w.id, w.name))
        .collect();
    Ok(lines.join("\n"))
}

fn tool_delete_workspace(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let workspace_id = arguments
        .get("workspace_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: workspace_id".to_string())?;

    // Close all floating task card windows for tasks in this workspace
    // before deleting them, preventing orphan windows with no DB record.
    if let Ok(tasks) = state.db.get_all_workspace_tasks(workspace_id) {
        for task in &tasks {
            if let Some(id) = task.id {
                crate::window::close_task_card(&state.app_handle, id);
            }
        }
    }

    // Check if this workspace is currently active; if so, deactivate it
    // so the frontend doesn't point to a non-existent workspace.
    let was_active = matches!(
        state.db.get_setting("active_workspace_id"),
        Ok(Some(val)) if val == workspace_id.to_string()
    );

    state.db.delete_workspace(workspace_id)?;

    if was_active {
        state.db.update_setting("active_workspace_id", "")?;
        let _ = state.app_handle.emit("workspace_deactivated", ());
    }

    commands::emit_tasks_updated(&state.app_handle, &state.db);
    Ok(format!("Workspace {} deleted.", workspace_id))
}

fn tool_get_workspace_tasks(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let workspace_id = arguments
        .get("workspace_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: workspace_id".to_string())?;

    let tasks = state.db.get_workspace_tasks(workspace_id)?;
    if tasks.is_empty() {
        return Ok("No tasks in this workspace.".to_string());
    }
    let lines: Vec<String> = tasks
        .iter()
        .map(|t| {
            let id = t.id.unwrap_or(0);
            format!(
                "- #{} {} (due: {})",
                id, t.title,
                if t.due_time.is_empty() { "no date" } else { &t.due_time }
            )
        })
        .collect();
    Ok(lines.join("\n"))
}

fn tool_snooze_task(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let task_id = arguments
        .get("task_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: task_id".to_string())?;
    let minutes = arguments
        .get("minutes")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: minutes".to_string())?;

    // MCP snooze: hide the card and re-show after N minutes with a background
    // thread (same approach as the Tauri command). Unlike the Tauri command
    // (which uses a fixed 30-min default), the MCP tool lets the caller
    // specify an exact duration. Crucially, we do NOT mutate the task's
    // due_date — the old Tauri-command approach did that and permanently
    // corrupted it.
    window::close_task_card(&state.app_handle, task_id);
    commands::pending_snoozes()
        .lock()
        .unwrap_or_else(|poisoned| {
            eprintln!("[snooze] Mutex poisoned, recovering");
            poisoned.into_inner()
        })
        .insert(task_id);

    let app_clone = state.app_handle.clone();
    let db_clone = state.db.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(minutes as u64 * 60));
        let task = match db_clone.get_task_by_id(task_id) {
            Ok(t) if !t.completed => t,
            _ => {
                let _ = commands::pending_snoozes().lock().map(|mut s| s.remove(&task_id));
                return;
            }
        };
        if !crate::commands::COMPACT_MODE.load(std::sync::atomic::Ordering::SeqCst)
            && !crate::commands::EDGE_PEEK_ENABLED.load(std::sync::atomic::Ordering::SeqCst)
        {
            let _ = window::open_task_card(&app_clone, &task, 0);
        } else {
            let _ = commands::pending_snoozes().lock().map(|mut s| s.remove(&task_id));
            return;
        }
        let _ = commands::pending_snoozes().lock().map(|mut s| s.remove(&task_id));
    });
    commands::emit_tasks_updated(&state.app_handle, &state.db);
    Ok(format!("Task {} snoozed for {} minutes.", task_id, minutes))
}

fn tool_update_setting(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let key = arguments
        .get("key")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing required argument: key".to_string())?
        .to_string();
    let value = arguments
        .get("value")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing required argument: value".to_string())?
        .to_string();

    state.db.update_setting(&key, &value)?;

    if key == "compact_mode" {
        let enabled = value == "true";
        crate::commands::COMPACT_MODE.store(enabled, std::sync::atomic::Ordering::SeqCst);
        if enabled {
            let _ = state.app_handle.emit("compact_mode_enabled", ());
        } else {
            let _ = state.app_handle.emit("compact_mode_disabled", ());
        }
    }

    Ok(format!("Setting '{}' set to '{}'.", key, value))
}

fn tool_activate_workspace(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let workspace_id = arguments
        .get("workspace_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: workspace_id".to_string())?;

    commands::activate_workspace_inner(&state.app_handle, &state.db, workspace_id)?;
    Ok(format!("Activated workspace {}.", workspace_id))
}

fn tool_deactivate_workspace(state: &McpState) -> Result<String, String> {
    commands::deactivate_workspace_inner(&state.app_handle, &state.db)?;
    Ok("Showing all workspaces.".to_string())
}

fn tool_align_tasks(state: &McpState) -> Result<String, String> {
    let windows = state.app_handle.webview_windows();
    let mut task_windows: Vec<_> = windows
        .into_iter()
        .filter(|(label, _)| label.starts_with("task_"))
        .collect();
    task_windows.sort_by(|a, b| a.0.cmp(&b.0));

    let count = task_windows.len();
    if count == 0 {
        return Ok("No task cards to align.".to_string());
    }

    let monitor = state
        .app_handle
        .primary_monitor()
        .map_err(|e| format!("Failed to get monitor: {e}"))?
        .ok_or_else(|| "No monitor found".to_string())?;
    let screen_width = monitor.size().width as f64 / monitor.scale_factor();

    let card_width = crate::window::CARD_WIDTH;
    let card_height = crate::window::CARD_HEIGHT;
    let padding = 10.0;
    let x = screen_width - card_width - padding;
    let start_y = 80.0;

    for (i, (_, window)) in task_windows.iter().enumerate() {
        let y = start_y + (i as f64 * (card_height + padding));
        let _ = window.set_position(tauri::PhysicalPosition::new(
            (x * monitor.scale_factor()).round() as i32,
            (y * monitor.scale_factor()).round() as i32,
        ));
    }

    Ok(format!("Aligned {} task cards.", count))
}

fn tool_uncomplete_task(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let task_id = arguments
        .get("task_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: task_id".to_string())?;

    let task = state.db.get_task_by_id(task_id)?;
    state.db.uncomplete_task(task_id)?;

    if crate::commands::COMPACT_MODE.load(std::sync::atomic::Ordering::SeqCst) {
        crate::window::open_compact_pill_window(&state.app_handle);
    } else if !crate::commands::EDGE_PEEK_ENABLED.load(std::sync::atomic::Ordering::SeqCst) {
        let _ = window::open_task_card(&state.app_handle, &task, 0);
        window::restack_task_cards(&state.app_handle);
    }

    commands::emit_tasks_updated(&state.app_handle, &state.db);
    Ok(format!("Task {} re-opened.", task_id))
}

fn tool_get_settings(state: &McpState) -> Result<String, String> {
    let map = state.db.get_settings_map()?;
    let lines: Vec<String> = map
        .iter()
        .map(|(k, v)| format!("{}: {}", k, v))
        .collect();
    if lines.is_empty() {
        return Ok("No settings found.".to_string());
    }
    Ok(lines.join("\n"))
}

fn tool_get_shake_interval(state: &McpState) -> Result<String, String> {
    let val = state.db.get_setting("shake_interval")?.unwrap_or_else(|| "30".to_string());
    Ok(format!("Shake interval: {} seconds.", val))
}

fn tool_set_shake_interval(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let seconds = arguments
        .get("seconds")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: seconds".to_string())?;
    state.db.update_setting("shake_interval", &seconds.to_string())?;
    let _ = state.app_handle.emit("shake_interval_changed", seconds);
    Ok(format!("Shake interval set to {} seconds.", seconds))
}

fn tool_get_shake_enabled(state: &McpState) -> Result<String, String> {
    let val = state.db.get_setting("shake_enabled")?.unwrap_or_else(|| "true".to_string());
    let enabled = val == "true";
    Ok(format!("Shake enabled: {}.", enabled))
}

fn tool_set_shake_enabled(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let enabled = arguments
        .get("enabled")
        .and_then(|v| v.as_bool())
        .ok_or_else(|| "Missing required argument: enabled".to_string())?;
    state.db.update_setting("shake_enabled", if enabled { "true" } else { "false" })?;
    let _ = state.app_handle.emit("shake_enabled_changed", enabled);
    Ok(format!("Shake {}.", if enabled { "enabled" } else { "disabled" }))
}

fn tool_get_daily_digest(state: &McpState) -> Result<String, String> {
    let tasks = state.db.get_all_tasks()?;
    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let mut overdue = 0;
    let mut due_today = 0;
    let mut active = 0;
    let mut completed = 0;

    for t in &tasks {
        if t.completed {
            completed += 1;
            continue;
        }
        active += 1;
        if !t.due_time.is_empty() {
            let date_part = &t.due_time[..10.min(t.due_time.len())];
            if date_part < today.as_str() {
                overdue += 1;
            } else if date_part == today.as_str() {
                due_today += 1;
            }
        }
    }

    Ok(format!(
        "Active: {} | Overdue: {} | Due today: {} | Completed: {}",
        active, overdue, due_today, completed
    ))
}

fn tool_load_workspace(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let workspace_id = arguments
        .get("workspace_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: workspace_id".to_string())?;

    let workspace = state.db.get_workspace_by_id(workspace_id)?;
    let parsed: serde_json::Value =
        serde_json::from_str(&workspace.state_json).map_err(|e| e.to_string())?;

    // Close existing task cards
    let windows = state.app_handle.webview_windows();
    for (label, window) in &windows {
        if label.starts_with("task_") {
            let _ = window.close();
        }
    }

    if !crate::commands::COMPACT_MODE.load(std::sync::atomic::Ordering::SeqCst)
        && !crate::commands::EDGE_PEEK_ENABLED.load(std::sync::atomic::Ordering::SeqCst)
    {
        if let Some(cards) = parsed["cards"].as_array() {
            for card in cards {
                let tid = card["task_id"].as_i64().unwrap_or(0);
                let x = card["x"].as_f64().unwrap_or(100.0);
                let y = card["y"].as_f64().unwrap_or(100.0);
                if let Ok(task) = state.db.get_task_by_id(tid) {
                    crate::window::open_task_card_window_at(&state.app_handle, &task, x, y);
                }
            }
        }
    }

    state.db.update_setting("active_workspace_id", &workspace_id.to_string())?;
    let _ = state.app_handle.emit("workspace_activated", serde_json::json!({ "name": workspace.name }));
    commands::emit_tasks_updated(&state.app_handle, &state.db);
    Ok(format!("Workspace {} loaded.", workspace_id))
}

fn tool_save_workspace(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let name = arguments
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing required argument: name".to_string())?
        .to_string();

    let windows = state.app_handle.webview_windows();
    let mut cards = vec![];
    for (label, window) in &windows {
        if label.starts_with("task_") {
            let task_id: i64 = label.replace("task_", "").parse().unwrap_or(0);
            if let Ok(pos) = window.outer_position() {
                let scale = window.scale_factor().unwrap_or(1.0);
                cards.push(serde_json::json!({
                    "task_id": task_id,
                    "x": (pos.x as f64 / scale).round(),
                    "y": (pos.y as f64 / scale).round()
                }));
            }
        }
    }
    let state_json = serde_json::json!({ "cards": cards }).to_string();
    let id = state.db.save_workspace(&name, &state_json)?;
    Ok(format!("Workspace '{}' saved with ID {}.", name, id))
}

fn tool_add_task_to_workspace(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let task_id = arguments
        .get("task_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: task_id".to_string())?;
    let workspace_id = arguments
        .get("workspace_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: workspace_id".to_string())?;

    state.db.set_task_workspace(task_id, Some(workspace_id))?;
    commands::emit_tasks_updated(&state.app_handle, &state.db);
    Ok(format!("Task {} added to workspace {}.", task_id, workspace_id))
}

fn tool_get_active_workspace_id(state: &McpState) -> Result<String, String> {
    let val = state.db.get_setting("active_workspace_id")?;
    match val {
        Some(id) if !id.is_empty() => Ok(format!("Active workspace ID: {}", id)),
        _ => Ok("No active workspace (showing all).".to_string()),
    }
}

fn tool_set_zen_mode(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let hidden = arguments
        .get("hidden")
        .and_then(|v| v.as_bool())
        .ok_or_else(|| "Missing required argument: hidden".to_string())?;

    let windows = state.app_handle.webview_windows();
    for (label, window) in &windows {
        if label.starts_with("task_") {
            if hidden {
                let _ = window.hide();
            } else {
                let _ = window.show();
            }
        }
    }
    crate::commands::ZEN_MODE.store(hidden, std::sync::atomic::Ordering::SeqCst);
    Ok(if hidden {
        "Zen mode enabled — all cards hidden.".to_string()
    } else {
        "Zen mode disabled — all cards visible.".to_string()
    })
}

fn tool_add_presceduled_task(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let title = arguments
        .get("title")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing required argument: title".to_string())?
        .to_string();

    let scheduled_at = arguments
        .get("scheduled_at")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Missing required argument: scheduled_at".to_string())?
        .to_string();

    let description = arguments
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let due_date = arguments
        .get("due_date")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Validate scheduled_at is not in the past
    let scheduled_dt = chrono::DateTime::parse_from_rfc3339(&scheduled_at)
        .map_err(|e| format!("Invalid scheduled_at format: {e}"))?;
    if scheduled_dt <= chrono::Utc::now() {
        return Err("scheduled_at must be in the future".to_string());
    }

    let id = state.db.create_presceduled_task(
        &title,
        &description,
        &scheduled_at,
        due_date.as_deref().unwrap_or(""),
        None,
        None,
        None,
    )?;

    commands::emit_tasks_updated(&state.app_handle, &state.db);
    Ok(format!("Pre-scheduled task '{}' created with ID {}.", title, id))
}

fn tool_get_presceduled_tasks(state: &McpState) -> Result<String, String> {
    let tasks = state.db.get_presceduled_tasks()?;
    if tasks.is_empty() {
        return Ok("No pre-scheduled tasks.".to_string());
    }
    let lines: Vec<String> = tasks
        .iter()
        .map(|t| {
            let id = t.id.unwrap_or(0);
            format!(
                "- #{} {} (scheduled: {}, due: {})",
                id,
                t.title,
                t.scheduled_at.as_deref().unwrap_or("unknown"),
                if t.due_time.is_empty() { "none" } else { &t.due_time }
            )
        })
        .collect();
    Ok(lines.join("\n"))
}

fn tool_get_card_position(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let task_id = arguments
        .get("task_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: task_id".to_string())?;

    let mut windows: Vec<String> = state
        .app_handle
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
    Ok(format!("Card {} is at position {}/{}", task_id, index + 1, total))
}

fn tool_focus_next_card(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let task_id = arguments
        .get("task_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: task_id".to_string())?;

    let mut windows: Vec<String> = state
        .app_handle
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
        return Ok("No cards to navigate.".to_string());
    }
    let next_index = (current_index + 1) % windows.len();
    let next_label = &windows[next_index];

    if let Some(window) = state.app_handle.get_webview_window(next_label) {
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok("Focused next card.".to_string())
}

fn tool_focus_prev_card(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let task_id = arguments
        .get("task_id")
        .and_then(|v| v.as_i64())
        .ok_or_else(|| "Missing required argument: task_id".to_string())?;

    let mut windows: Vec<String> = state
        .app_handle
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
        return Ok("No cards to navigate.".to_string());
    }
    let prev_index = if current_index == 0 {
        windows.len() - 1
    } else {
        current_index - 1
    };
    let prev_label = &windows[prev_index];

    if let Some(window) = state.app_handle.get_webview_window(prev_label) {
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok("Focused previous card.".to_string())
}

fn tool_get_autostart_state(state: &McpState) -> Result<String, String> {
    match state.app_handle.autolaunch().is_enabled() {
        Ok(enabled) => Ok(format!("Autostart enabled: {}", enabled)),
        Err(e) => Err(format!("Failed to check autostart state: {e}")),
    }
}

fn tool_set_autostart(
    arguments: serde_json::Map<String, Value>,
    state: &McpState,
) -> Result<String, String> {
    let enabled = arguments
        .get("enabled")
        .and_then(|v| v.as_bool())
        .ok_or_else(|| "Missing required argument: enabled".to_string())?;

    if enabled {
        state.app_handle.autolaunch().enable().map_err(|e| format!("Failed to enable autostart: {e}"))?;
        Ok("Autostart enabled.".to_string())
    } else {
        state.app_handle.autolaunch().disable().map_err(|e| format!("Failed to disable autostart: {e}"))?;
        Ok("Autostart disabled.".to_string())
    }
}
