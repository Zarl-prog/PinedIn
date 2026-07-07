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
use tauri::AppHandle;
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

    let task = state
        .db
        .create_task_with_tags(&title, &description, &due_date, None, None, None, None)?;

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
