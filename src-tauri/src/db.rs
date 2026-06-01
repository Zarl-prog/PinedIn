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
    pub repeat: bool,
    pub snooze_count: i32,
    pub completed: bool,
    pub created_at: String,
}

/// Represents app settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub default_snooze_minutes: i32,
    pub start_on_boot: bool,
    pub sound_enabled: bool,
    pub theme: String,
    pub quiet_hours_start: Option<String>,
    pub quiet_hours_end: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_snooze_minutes: 10,
            start_on_boot: false,
            sound_enabled: true,
            theme: "dark".to_string(),
            quiet_hours_start: None,
            quiet_hours_end: None,
        }
    }
}

/// Thread-safe database handle.
/// Mutex<Connection> already implements Send + Sync because Connection is Send.
pub struct DbHandle {
    conn: Mutex<Connection>,
}

impl DbHandle {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;

        let db_path = app_data_dir.join("pinedin.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;

        conn.execute_batch("PRAGMA journal_mode=WAL;")
            .map_err(|e| format!("Failed to set journal mode: {}", e))?;

        let handle = Self {
            conn: Mutex::new(conn),
        };
        handle.initialize()?;
        Ok(handle)
    }

    fn initialize(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                urgency TEXT NOT NULL DEFAULT 'medium' CHECK(urgency IN ('low', 'medium', 'critical')),
                due_time TEXT NOT NULL,
                repeat INTEGER NOT NULL DEFAULT 0,
                snooze_count INTEGER NOT NULL DEFAULT 0,
                completed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            INSERT OR IGNORE INTO settings (key, value) VALUES
                ('default_snooze_minutes', '10'),
                ('start_on_boot', 'false'),
                ('sound_enabled', 'true'),
                ('theme', 'dark'),
                ('quiet_hours_start', ''),
                ('quiet_hours_end', '');"
        ).map_err(|e| format!("Failed to initialize database: {}", e))?;
        Ok(())
    }

    // ─── Tasks ───────────────────────────────────────────────────────────

    pub fn create_task(
        &self,
        title: &str,
        description: &str,
        urgency: &str,
        due_time: &str,
        repeat: bool,
    ) -> Result<Task, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO tasks (title, description, urgency, due_time, repeat, snooze_count, completed, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6)",
            rusqlite::params![title, description, urgency, due_time, repeat as i32, now],
        ).map_err(|e| format!("Failed to create task: {}", e))?;

        let id = conn.last_insert_rowid();
        Ok(Task {
            id: Some(id),
            title: title.to_string(),
            description: description.to_string(),
            urgency: urgency.to_string(),
            due_time: due_time.to_string(),
            repeat,
            snooze_count: 0,
            completed: false,
            created_at: now,
        })
    }

    pub fn get_all_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let mut stmt = conn.prepare(
            "SELECT id, title, description, urgency, due_time, repeat, snooze_count, completed, created_at
             FROM tasks
             ORDER BY
                CASE urgency
                    WHEN 'critical' THEN 0
                    WHEN 'medium' THEN 1
                    WHEN 'low' THEN 2
                END,
                due_time ASC"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let tasks = stmt.query_map([], |row| {
            Ok(Task {
                id: Some(row.get(0)?),
                title: row.get(1)?,
                description: row.get(2)?,
                urgency: row.get(3)?,
                due_time: row.get(4)?,
                repeat: row.get::<_, i32>(5)? != 0,
                snooze_count: row.get(6)?,
                completed: row.get::<_, i32>(7)? != 0,
                created_at: row.get(8)?,
            })
        }).map_err(|e| format!("Query error: {}", e))?
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
        repeat: bool,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "UPDATE tasks SET title=?1, description=?2, urgency=?3, due_time=?4, repeat=?5 WHERE id=?6",
            rusqlite::params![title, description, urgency, due_time, repeat as i32, id],
        ).map_err(|e| format!("Failed to update task: {}", e))?;
        Ok(())
    }

    pub fn delete_task(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute("DELETE FROM tasks WHERE id=?1", rusqlite::params![id])
            .map_err(|e| format!("Failed to delete task: {}", e))?;
        Ok(())
    }

    pub fn complete_task(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute("UPDATE tasks SET completed=1 WHERE id=?1", rusqlite::params![id])
            .map_err(|e| format!("Failed to complete task: {}", e))?;
        Ok(())
    }

    pub fn snooze_task(&self, id: i64, snooze_minutes: i32) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;

        let (urgency, snooze_count): (String, i32) = conn
            .query_row(
                "SELECT urgency, snooze_count FROM tasks WHERE id=?1",
                rusqlite::params![id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|e| format!("Failed to get task: {}", e))?;

        if urgency == "critical" && snooze_count >= 2 {
            return Err("Critical tasks cannot be snoozed more than 2 times".to_string());
        }

        let new_due = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::minutes(snooze_minutes as i64))
            .ok_or_else(|| "Failed to calculate new due time".to_string())?
            .to_rfc3339();

        conn.execute(
            "UPDATE tasks SET due_time=?1, snooze_count=snooze_count+1 WHERE id=?2",
            rusqlite::params![new_due, id],
        ).map_err(|e| format!("Failed to snooze task: {}", e))?;

        Ok(())
    }

    pub fn get_due_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let now = chrono::Utc::now().to_rfc3339();

        let mut stmt = conn.prepare(
            "SELECT id, title, description, urgency, due_time, repeat, snooze_count, completed, created_at
             FROM tasks
             WHERE completed = 0 AND due_time <= ?1
             ORDER BY
                CASE urgency
                    WHEN 'critical' THEN 0
                    WHEN 'medium' THEN 1
                    WHEN 'low' THEN 2
                END,
                due_time ASC"
        ).map_err(|e| format!("Failed to prepare query: {}", e))?;

        let tasks = stmt.query_map(rusqlite::params![now], |row| {
            Ok(Task {
                id: Some(row.get(0)?),
                title: row.get(1)?,
                description: row.get(2)?,
                urgency: row.get(3)?,
                due_time: row.get(4)?,
                repeat: row.get::<_, i32>(5)? != 0,
                snooze_count: row.get(6)?,
                completed: row.get::<_, i32>(7)? != 0,
                created_at: row.get(8)?,
            })
        }).map_err(|e| format!("Query error: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

        Ok(tasks)
    }

    // ─── Settings ────────────────────────────────────────────────────────

    pub fn get_settings_map(&self) -> Result<std::collections::HashMap<String, String>, String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        let mut stmt = conn.prepare("SELECT key, value FROM settings")
            .map_err(|e| format!("Failed to prepare: {}", e))?;

        let mut map = std::collections::HashMap::new();
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        }).map_err(|e| format!("Query error: {}", e))?;

        for row in rows {
            if let Ok((key, value)) = row {
                map.insert(key, value);
            }
        }
        Ok(map)
    }

    pub fn get_settings(&self) -> Result<AppSettings, String> {
        let map = self.get_settings_map()?;
        Ok(AppSettings {
            default_snooze_minutes: map.get("default_snooze_minutes").and_then(|v| v.parse().ok()).unwrap_or(10),
            start_on_boot: map.get("start_on_boot").map(|v| v == "true").unwrap_or(false),
            sound_enabled: map.get("sound_enabled").map(|v| v == "true").unwrap_or(true),
            theme: map.get("theme").cloned().unwrap_or_else(|| "dark".to_string()),
            quiet_hours_start: map.get("quiet_hours_start").and_then(|s| if s.is_empty() { None } else { Some(s.clone()) }),
            quiet_hours_end: map.get("quiet_hours_end").and_then(|s| if s.is_empty() { None } else { Some(s.clone()) }),
        })
    }

    pub fn update_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| format!("Lock error: {}", e))?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![key, value],
        ).map_err(|e| format!("Failed to update setting: {}", e))?;
        Ok(())
    }

    pub fn is_in_quiet_hours(&self) -> Result<bool, String> {
        let settings = self.get_settings_map()?;
        let start = settings.get("quiet_hours_start").and_then(|s| if s.is_empty() { None } else { Some(s.clone()) });
        let end = settings.get("quiet_hours_end").and_then(|s| if s.is_empty() { None } else { Some(s.clone()) });

        match (start, end) {
            (Some(start), Some(end)) => {
                let now = chrono::Local::now().format("%H:%M").to_string();
                if start <= end {
                    Ok(now >= start && now < end)
                } else {
                    Ok(now >= start || now < end)
                }
            }
            _ => Ok(false),
        }
    }
}
