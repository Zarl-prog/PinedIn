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
use tauri::{AppHandle, Emitter};
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
        println!("PinedIn MCP server running on http://{}/sse", addr);

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
            handle_tool_call(&id, params, &state).await
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
                    "description": "Add a new task to PinedIn. The task will appear as a floating card on the user's screen immediately.",
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
                    "description": "List all active (incomplete) tasks in PinedIn",
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
                    "description": "Change any PinedIn setting by key/value pair (e.g. compact_mode, daily_digest_enabled)",
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
                }
            ]
        }
    })))
}

async fn handle_tool_call(
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
        "add_multiple_tasks" => tool_add_multiple_tasks(arguments, state).await,
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
        let _ = commands::emit_tasks_updated(&state.app_handle, &state.db);
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
    let _ = window::close_task_card(&state.app_handle, task_id);
    let _ = commands::emit_tasks_updated(&state.app_handle, &state.db);

    Ok(format!("Task {} marked as complete.", task_id))
}

async fn tool_add_multiple_tasks(
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

    let _ = commands::emit_tasks_updated(&state.app_handle, &state.db);

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

    let _ = commands::emit_tasks_updated(&state.app_handle, &state.db);
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
    let _ = window::close_task_card(&state.app_handle, task_id);
    let _ = commands::emit_tasks_updated(&state.app_handle, &state.db);
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

    state.db.delete_workspace(workspace_id)?;
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

    let task = state.db.get_task_by_id(task_id)?;
    let now = chrono::Utc::now();
    let snooze_until = now + chrono::Duration::minutes(minutes);
    let due = snooze_until.format("%Y-%m-%d %H:%M").to_string();

    state.db.update_task(
        task_id,
        &task.title,
        &task.description,
        &due,
        None,
        None,
        None,
        None,
    )?;

    let _ = window::close_task_card(&state.app_handle, task_id);
    let _ = commands::emit_tasks_updated(&state.app_handle, &state.db);
    Ok(format!("Task {} snoozed until {}.", task_id, due))
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
        let _ = state.app_handle.emit("compact_mode_changed", value == "true");
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

    state.db.update_setting("active_workspace_id", &workspace_id.to_string())?;
    let _ = state.app_handle.emit("active_workspace_changed", workspace_id);
    Ok(format!("Activated workspace {}.", workspace_id))
}

fn tool_deactivate_workspace(state: &McpState) -> Result<String, String> {
    state.db.update_setting("active_workspace_id", "")?;
    let _ = state.app_handle.emit("active_workspace_changed", serde_json::Value::Null);
    Ok("Showing all workspaces.".to_string())
}
