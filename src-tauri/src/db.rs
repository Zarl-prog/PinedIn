use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

/// Return true if the named column exists on the named table. Used to
/// make schema migrations idempotent.
fn column_exists(conn: &Connection, table: &str, column: &str) -> bool {
    let sql = format!("PRAGMA table_info({})", table);
    let mut stmt = match conn.prepare(&sql) {
        Ok(s) => s,
        Err(_) => return false,
    };
    let mut rows = match stmt.query([]) {
        Ok(r) => r,
        Err(_) => return false,
    };
    while let Ok(Some(row)) = rows.next() {
        if let Ok(name) = row.get::<_, String>(1) {
            if name.eq_ignore_ascii_case(column) {
                return true;
            }
        }
    }
    false
}

/// Represents a task in the database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: Option<i64>,
    pub title: String,
    pub description: String,
    pub urgency: String,
    pub due_time: String,
    pub completed: bool,
    pub created_at: String,
    pub recurrence: Option<String>,
    pub tags: Option<String>,
    pub time_limit_minutes: Option<i64>,
    pub started_at: Option<String>,
}

/// Represents app settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "dark".to_string(),
        }
    }
}

/// Thread-safe database handle.
pub struct DbHandle {
    conn: Mutex<Connection>,
}

impl DbHandle {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {e}"))?;

        let db_path = app_data_dir.join("pinedin.db");
        let conn =
            Connection::open(&db_path).map_err(|e| format!("Failed to open database: {e}"))?;

        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| format!("Failed to set journal mode: {e}"))?;

        let handle = Self {
            conn: Mutex::new(conn),
        };
        handle.initialize()?;
        Ok(handle)
    }

    fn initialize(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                urgency TEXT NOT NULL DEFAULT 'medium' CHECK(urgency IN ('low', 'medium', 'critical')),
                due_time TEXT NOT NULL DEFAULT '',
                completed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                recurrence TEXT DEFAULT NULL,
                tags TEXT DEFAULT NULL,
                time_limit_minutes INTEGER DEFAULT NULL,
                started_at TEXT DEFAULT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            INSERT OR IGNORE INTO settings (key, value) VALUES
                ('theme', 'dark'),
                ('shake_interval', '30');"
        ).map_err(|e| format!("Failed to initialize database: {e}"))?;

        // Idempotent migrations for pre-v0.3.0 databases that lack
        // recurrence/tags, and for pre-time-limit databases that lack
        // time_limit_minutes/started_at. ALTER TABLE fails with
        // "duplicate column" on already-updated schemas, which is the
        // expected outcome.
        if !column_exists(&conn, "tasks", "recurrence") {
            let _ = conn.execute(
                "ALTER TABLE tasks ADD COLUMN recurrence TEXT DEFAULT NULL",
                [],
            );
        }
        if !column_exists(&conn, "tasks", "tags") {
            let _ = conn.execute("ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT NULL", []);
        }
        if !column_exists(&conn, "tasks", "time_limit_minutes") {
            let _ = conn.execute(
                "ALTER TABLE tasks ADD COLUMN time_limit_minutes INTEGER DEFAULT NULL",
                [],
            );
        }
        if !column_exists(&conn, "tasks", "started_at") {
            let _ = conn.execute(
                "ALTER TABLE tasks ADD COLUMN started_at TEXT DEFAULT NULL",
                [],
            );
        }
        Ok(())
    }

    // ─── Tasks ───────────────────────────────────────────────────────────

    pub fn create_task(
        &self,
        title: &str,
        description: &str,
        urgency: &str,
        due_time: &str,
    ) -> Result<Task, String> {
        self.create_task_with_tags(title, description, urgency, due_time, None, None, None)
    }

    pub fn create_task_with_recurrence(
        &self,
        title: &str,
        description: &str,
        urgency: &str,
        due_time: &str,
        recurrence: Option<&str>,
    ) -> Result<Task, String> {
        self.create_task_with_tags(
            title,
            description,
            urgency,
            due_time,
            recurrence,
            None,
            None,
        )
    }

    /// Insert a task. When `time_limit_minutes` is set, `started_at` is
    /// populated with the current local time so the frontend can compute
    /// remaining time even after a restart.
    pub fn create_task_with_tags(
        &self,
        title: &str,
        description: &str,
        urgency: &str,
        due_time: &str,
        recurrence: Option<&str>,
        tags: Option<&str>,
        time_limit_minutes: Option<i64>,
    ) -> Result<Task, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let now = chrono::Utc::now().to_rfc3339();
        let started_at = if time_limit_minutes.is_some() {
            Some(chrono::Local::now().to_rfc3339())
        } else {
            None
        };

        conn.execute(
            "INSERT INTO tasks (title, description, urgency, due_time, completed, created_at, recurrence, tags, time_limit_minutes, started_at)
             VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![
                title,
                description,
                urgency,
                due_time,
                now,
                recurrence,
                tags,
                time_limit_minutes,
                started_at
            ],
        ).map_err(|e| format!("Failed to create task: {e}"))?;

        let id = conn.last_insert_rowid();
        Ok(Task {
            id: Some(id),
            title: title.to_string(),
            description: description.to_string(),
            urgency: urgency.to_string(),
            due_time: due_time.to_string(),
            completed: false,
            created_at: now,
            recurrence: recurrence.map(|s| s.to_string()),
            tags: tags.map(|s| s.to_string()),
            time_limit_minutes,
            started_at,
        })
    }

    pub fn get_all_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let mut stmt = conn.prepare(
            "SELECT id, title, description, urgency, due_time, completed, created_at, recurrence, tags, time_limit_minutes, started_at
             FROM tasks
             ORDER BY
                CASE urgency
                    WHEN 'critical' THEN 0
                    WHEN 'medium' THEN 1
                    WHEN 'low' THEN 2
                END,
                created_at ASC"
        ).map_err(|e| format!("Failed to prepare query: {e}"))?;

        let tasks = stmt
            .query_map([], |row| {
                Ok(Task {
                    id: Some(row.get(0)?),
                    title: row.get(1)?,
                    description: row.get(2)?,
                    urgency: row.get(3)?,
                    due_time: row.get(4)?,
                    completed: row.get::<_, i32>(5)? != 0,
                    created_at: row.get(6)?,
                    recurrence: row.get(7)?,
                    tags: row.get(8)?,
                    time_limit_minutes: row.get(9)?,
                    started_at: row.get(10)?,
                })
            })
            .map_err(|e| format!("Query error: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(tasks)
    }

    pub fn get_incomplete_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let mut stmt = conn.prepare(
            "SELECT id, title, description, urgency, due_time, completed, created_at, recurrence, tags, time_limit_minutes, started_at
             FROM tasks
             WHERE completed = 0
             ORDER BY
                CASE urgency
                    WHEN 'critical' THEN 0
                    WHEN 'medium' THEN 1
                    WHEN 'low' THEN 2
                END,
                created_at ASC"
        ).map_err(|e| format!("Failed to prepare query: {e}"))?;

        let tasks = stmt
            .query_map([], |row| {
                Ok(Task {
                    id: Some(row.get(0)?),
                    title: row.get(1)?,
                    description: row.get(2)?,
                    urgency: row.get(3)?,
                    due_time: row.get(4)?,
                    completed: row.get::<_, i32>(5)? != 0,
                    created_at: row.get(6)?,
                    recurrence: row.get(7)?,
                    tags: row.get(8)?,
                    time_limit_minutes: row.get(9)?,
                    started_at: row.get(10)?,
                })
            })
            .map_err(|e| format!("Query error: {e}"))?
            .filter_map(|r| r.ok())
            .collect();

        Ok(tasks)
    }

    pub fn get_task_by_id(&self, id: i64) -> Result<Task, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.query_row(
            "SELECT id, title, description, urgency, due_time, completed, created_at, recurrence, tags, time_limit_minutes, started_at
             FROM tasks WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(Task {
                    id: Some(row.get(0)?),
                    title: row.get(1)?,
                    description: row.get(2)?,
                    urgency: row.get(3)?,
                    due_time: row.get(4)?,
                    completed: row.get::<_, i32>(5)? != 0,
                    created_at: row.get(6)?,
                    recurrence: row.get(7)?,
                    tags: row.get(8)?,
                    time_limit_minutes: row.get(9)?,
                    started_at: row.get(10)?,
                })
            }
        ).map_err(|e| format!("Failed to get task by id: {e}"))
    }

    pub fn update_task(
        &self,
        id: i64,
        title: &str,
        description: &str,
        urgency: &str,
        due_time: &str,
        recurrence: Option<&str>,
        tags: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute(
            "UPDATE tasks SET title=?1, description=?2, urgency=?3, due_time=?4, recurrence=?5, tags=?6 WHERE id=?7",
            rusqlite::params![title, description, urgency, due_time, recurrence, tags, id],
        ).map_err(|e| format!("Failed to update task: {e}"))?;
        Ok(())
    }

    pub fn delete_task(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute("DELETE FROM tasks WHERE id=?1", rusqlite::params![id])
            .map_err(|e| format!("Failed to delete task: {e}"))?;
        Ok(())
    }

    pub fn complete_task(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute(
            "UPDATE tasks SET completed=1 WHERE id=?1",
            rusqlite::params![id],
        )
        .map_err(|e| format!("Failed to complete task: {e}"))?;
        Ok(())
    }

    pub fn uncomplete_task(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute(
            "UPDATE tasks SET completed=0 WHERE id=?1",
            rusqlite::params![id],
        )
        .map_err(|e| format!("Failed to uncomplete task: {e}"))?;
        Ok(())
    }

    // ─── Daily Digest Queries ──────────────────────────────────────────────

    /// Count tasks due strictly before `today` that are still incomplete.
    /// Tasks with an empty due_time are excluded (never scheduled).
    pub fn count_overdue_tasks(&self, today: &str) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks
                 WHERE due_time != '' AND due_time < ?1 AND completed = 0",
                rusqlite::params![today],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to count overdue tasks: {e}"))?;
        Ok(n)
    }

    /// Count incomplete tasks whose due_time is exactly `today`.
    pub fn count_due_today(&self, today: &str) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks
                 WHERE due_time = ?1 AND completed = 0",
                rusqlite::params![today],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to count tasks due today: {e}"))?;
        Ok(n)
    }

    /// Count incomplete tasks whose due_time is exactly `date` — used
    /// to surface items that were due yesterday and still aren't done.
    pub fn count_unfinished_from_date(&self, date: &str) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks
                 WHERE due_time = ?1 AND completed = 0",
                rusqlite::params![date],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to count unfinished tasks: {e}"))?;
        Ok(n)
    }

    /// Count every incomplete task, regardless of due date.
    pub fn count_active_tasks(&self) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let n: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM tasks WHERE completed = 0",
                [],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to count active tasks: {e}"))?;
        Ok(n)
    }

    // ─── Settings ────────────────────────────────────────────────────────

    pub fn get_settings_map(&self) -> Result<std::collections::HashMap<String, String>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let mut stmt = conn
            .prepare("SELECT key, value FROM settings")
            .map_err(|e| format!("Failed to prepare: {e}"))?;

        let mut map = std::collections::HashMap::new();
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| format!("Query error: {e}"))?;

        for row in rows {
            if let Ok((key, value)) = row {
                map.insert(key, value);
            }
        }
        Ok(map)
    }

    pub fn get_settings(&self) -> Result<AppSettings, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let mut stmt = conn
            .prepare("SELECT key, value FROM settings")
            .map_err(|e| format!("Failed to prepare: {e}"))?;

        let mut map = std::collections::HashMap::new();
        let rows = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| format!("Query error: {e}"))?;

        for row in rows {
            if let Ok((key, value)) = row {
                map.insert(key, value);
            }
        }

        Ok(AppSettings {
            theme: map
                .get("theme")
                .cloned()
                .unwrap_or_else(|| "dark".to_string()),
        })
    }

    pub fn update_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, value],
        )
        .map_err(|e| format!("Failed to update setting: {e}"))?;
        Ok(())
    }
}
