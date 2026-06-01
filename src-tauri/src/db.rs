use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

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
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {e}"))?;

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
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            INSERT OR IGNORE INTO settings (key, value) VALUES
                ('theme', 'dark');"
        ).map_err(|e| format!("Failed to initialize database: {e}"))?;
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
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO tasks (title, description, urgency, due_time, completed, created_at)
             VALUES (?1, ?2, ?3, ?4, 0, ?5)",
            rusqlite::params![title, description, urgency, due_time, now],
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
        })
    }

    pub fn get_all_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let mut stmt = conn.prepare(
            "SELECT id, title, description, urgency, due_time, completed, created_at
             FROM tasks
             ORDER BY
                CASE urgency
                    WHEN 'critical' THEN 0
                    WHEN 'medium' THEN 1
                    WHEN 'low' THEN 2
                END,
                created_at ASC"
        ).map_err(|e| format!("Failed to prepare query: {e}"))?;

        let tasks = stmt.query_map([], |row| {
            Ok(Task {
                id: Some(row.get(0)?),
                title: row.get(1)?,
                description: row.get(2)?,
                urgency: row.get(3)?,
                due_time: row.get(4)?,
                completed: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
            })
        }).map_err(|e| format!("Query error: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

        Ok(tasks)
    }

    pub fn get_incomplete_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let mut stmt = conn.prepare(
            "SELECT id, title, description, urgency, due_time, completed, created_at
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

        let tasks = stmt.query_map([], |row| {
            Ok(Task {
                id: Some(row.get(0)?),
                title: row.get(1)?,
                description: row.get(2)?,
                urgency: row.get(3)?,
                due_time: row.get(4)?,
                completed: row.get::<_, i32>(5)? != 0,
                created_at: row.get(6)?,
            })
        }).map_err(|e| format!("Query error: {e}"))?
        .filter_map(|r| r.ok())
        .collect();

        Ok(tasks)
    }

    pub fn update_task(
        &self,
        id: i64,
        title: &str,
        description: &str,
        urgency: &str,
        due_time: &str,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute(
            "UPDATE tasks SET title=?1, description=?2, urgency=?3, due_time=?4 WHERE id=?5",
            rusqlite::params![title, description, urgency, due_time, id],
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
        conn.execute("UPDATE tasks SET completed=1 WHERE id=?1", rusqlite::params![id])
            .map_err(|e| format!("Failed to complete task: {e}"))?;
        Ok(())
    }

    // ─── Settings ────────────────────────────────────────────────────────

    pub fn get_settings_map(&self) -> Result<std::collections::HashMap<String, String>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let mut stmt = conn.prepare("SELECT key, value FROM settings")
            .map_err(|e| format!("Failed to prepare: {e}"))?;

        let mut map = std::collections::HashMap::new();
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).map_err(|e| format!("Query error: {e}"))?;

        for row in rows {
            if let Ok((key, value)) = row {
                map.insert(key, value);
            }
        }
        Ok(map)
    }

    pub fn get_settings(&self) -> Result<AppSettings, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        let mut stmt = conn.prepare("SELECT key, value FROM settings")
            .map_err(|e| format!("Failed to prepare: {e}"))?;

        let mut map = std::collections::HashMap::new();
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).map_err(|e| format!("Query error: {e}"))?;

        for row in rows {
            if let Ok((key, value)) = row {
                map.insert(key, value);
            }
        }

        Ok(AppSettings {
            theme: map.get("theme").cloned().unwrap_or_else(|| "dark".to_string()),
        })
    }

    pub fn update_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {e}"))?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, value],
        ).map_err(|e| format!("Failed to update setting: {e}"))?;
        Ok(())
    }
}
