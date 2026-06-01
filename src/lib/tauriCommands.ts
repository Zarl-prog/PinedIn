/**
 * Typed wrappers for all Tauri invoke() calls.
 * Never call invoke() directly in components - always use these wrappers.
 */
import { invoke } from "@tauri-apps/api/core";

// ─── Type Definitions ───────────────────────────────────────────────────────

export interface Task {
  id?: number | null;
  title: string;
  description: string;
  urgency: "low" | "medium" | "critical";
  due_time: string;
  repeat: boolean;
  snooze_count: number;
  completed: boolean;
  created_at: string;
}

export interface AppSettings {
  default_snooze_minutes: number;
  start_on_boot: boolean;
  sound_enabled: boolean;
  theme: "light" | "dark" | "system";
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

// ─── Task Commands ──────────────────────────────────────────────────────────

export async function createTask(
  title: string,
  description: string,
  urgency: string,
  dueTime: string,
  repeat: boolean,
): Promise<Task> {
  return invoke<Task>("create_task", {
    title,
    description,
    urgency,
    dueTime,
    repeat,
  });
}

export async function getAllTasks(): Promise<Task[]> {
  return invoke<Task[]>("get_all_tasks");
}

export async function updateTask(
  id: number,
  title: string,
  description: string,
  urgency: string,
  dueTime: string,
  repeat: boolean,
): Promise<void> {
  return invoke("update_task", {
    id,
    title,
    description,
    urgency,
    dueTime,
    repeat,
  });
}

export async function deleteTask(id: number): Promise<void> {
  return invoke("delete_task", { id });
}

export async function completeTask(id: number): Promise<void> {
  return invoke("complete_task", { id });
}

export async function snoozeTask(
  id: number,
  snoozeMinutes: number,
): Promise<void> {
  return invoke("snooze_task", { id, snoozeMinutes });
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

// ─── Window Commands ────────────────────────────────────────────────────────

export async function showMainWindow(): Promise<void> {
  return invoke("show_main_window");
}

// ─── Scheduler Commands ─────────────────────────────────────────────────────

export async function togglePauseReminders(): Promise<boolean> {
  return invoke<boolean>("toggle_pause_reminders");
}
