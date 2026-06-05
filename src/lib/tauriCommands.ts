import { invoke } from "@tauri-apps/api/core";

// ─── Type Definitions ───────────────────────────────────────────────────────

export interface Task {
  id?: number | null;
  title: string;
  description: string;
  urgency: "low" | "medium" | "critical";
  due_time: string;
  completed: boolean;
  created_at: string;
  recurrence: string | null;
  tags: string | null;
}

export interface AppSettings {
  theme: "light" | "dark" | "system";
}

// ─── Task Commands ──────────────────────────────────────────────────────────

export async function createTask(
  title: string,
  description: string,
  urgency: string,
  due_time: string,
  recurrence?: string | null,
  tags?: string | null,
): Promise<Task> {
  return invoke<Task>("create_task", {
    title,
    description,
    urgency,
    dueTime: due_time,
    recurrence: recurrence ?? null,
    tags: tags ?? null,
  });
}

export async function getAllTasks(): Promise<Task[]> {
  return invoke<Task[]>("get_all_tasks");
}

export async function getIncompleteTasks(): Promise<Task[]> {
  return invoke<Task[]>("get_incomplete_tasks");
}

export async function updateTask(
  id: number,
  title: string,
  description: string,
  urgency: string,
  due_time: string,
): Promise<void> {
  return invoke("update_task", {
    id,
    title,
    description,
    urgency,
    dueTime: due_time,
  });
}

export async function deleteTask(id: number): Promise<void> {
  return invoke("delete_task", { id });
}

export async function completeTask(id: number): Promise<void> {
  return invoke("complete_task", { id });
}

export async function uncompleteTask(id: number): Promise<void> {
  return invoke("uncomplete_task", { id });
}

// ─── Settings Commands ──────────────────────────────────────────────────────

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function updateSetting(
  key: string,
  value: string,
): Promise<void> {
  return invoke("update_setting", { key, value });
}

// ─── Task Card Commands ─────────────────────────────────────────────────────

export async function getTaskById(id: number): Promise<Task> {
  return invoke<Task>("get_task_by_id", { id });
}

export async function snoozeTask(id: number): Promise<void> {
  return invoke("snooze_task", { id });
}

// ─── Shake Interval Commands ─────────────────────────────────────────────────

export async function getShakeInterval(): Promise<number> {
  return invoke<number>("get_shake_interval");
}

export async function setShakeInterval(seconds: number): Promise<void> {       
  return invoke("set_shake_interval", { seconds });
}

export async function triggerTaskEdit(id: number): Promise<void> {
  return invoke("trigger_task_edit", { id });
}

// ─── Autostart Commands ──────────────────────────────────────────────────────
export async function enableAutostart(): Promise<void> {
  return invoke("enable_autostart");
}

export async function disableAutostart(): Promise<void> {
  return invoke("disable_autostart");
}

export async function isAutostartEnabled(): Promise<boolean> {
  return invoke<boolean>("is_autostart_enabled");
}
