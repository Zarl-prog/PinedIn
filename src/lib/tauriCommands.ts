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
): Promise<Task> {
  return invoke<Task>("create_task", {
    title,
    description,
    urgency,
    dueTime: due_time,
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
