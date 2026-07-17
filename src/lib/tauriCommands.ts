import { invoke } from "@tauri-apps/api/core";

// ─── Type Definitions ───────────────────────────────────────────────────────

export interface Task {
  id?: number | null;
  title: string;
  description: string;
  due_time: string;
  completed: boolean;
  created_at: string;
  recurrence: string | null;
  tags: string | null;
  time_limit_minutes: number | null;
  started_at: string | null;
  is_presceduled: number;
  scheduled_at: string | null;
  workspace_id: number | null;
}

export interface AppSettings {
  theme: "light" | "dark" | "parchment" | "system";
}

// ─── Quick Add ────────────────────────────────────────────────────────────────
export async function quickAddTask(
  title: string,
  dueDate: string,
): Promise<void> {
  return invoke("quick_add_task", { title, dueDate });
}

// ─── Task Commands ──────────────────────────────────────────────────────────

export async function createTask(
  title: string,
  description: string,
  due_time: string,
  recurrence?: string | null,
  tags?: string | null,
  timeLimitMinutes?: number | null,
  workspaceId?: number | null,
): Promise<Task> {
  return invoke<Task>("create_task", {
    title,
    description,
    dueTime: due_time,
    recurrence: recurrence ?? null,
    tags: tags ?? null,
    timeLimitMinutes: timeLimitMinutes ?? null,
    workspaceId: workspaceId ?? null,
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
  due_time: string,
  recurrence?: string | null,
  tags?: string | null,
  timeLimitMinutes?: number | null,
  startedAt?: string | null,
): Promise<void> {
  return invoke("update_task", {
    id,
    title,
    description,
    dueTime: due_time,
    recurrence: recurrence ?? null,
    tags: tags ?? null,
    timeLimitMinutes: timeLimitMinutes ?? null,
    startedAt: startedAt ?? null,
  });
}

export async function deleteTask(id: number): Promise<void> {
  return invoke("delete_task", { id });
}

export async function closeTaskCard(taskId: number): Promise<void> {
  return invoke("close_task_card", { taskId });
}

export async function completeTask(id: number): Promise<void> {
  return invoke("complete_task", { id });
}

export async function uncompleteTask(id: number): Promise<void> {
  return invoke("uncomplete_task", { id });
}

// ─── Settings Commands ──────────────────────────────────────────────────────

export interface SettingsMap {
  [key: string]: string;
}

export async function getSettings(): Promise<AppSettings> {
  return invoke<AppSettings>("get_settings");
}

export async function getSettingsMap(): Promise<SettingsMap> {
  return invoke<SettingsMap>("get_settings_map");
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

export async function fireTimeLimitNotification(
  taskId: number,
  taskTitle: string,
): Promise<void> {
  return invoke("fire_time_limit_notification", { taskId, taskTitle });
}

// ─── Shake Interval Commands ─────────────────────────────────────────────────

export async function getShakeInterval(): Promise<number> {
  return invoke<number>("get_shake_interval");
}

export async function setShakeInterval(seconds: number): Promise<void> {
  return invoke("set_shake_interval", { seconds });
}

export async function getShakeEnabled(): Promise<boolean> {
  return invoke<boolean>("get_shake_enabled");
}

export async function setShakeEnabled(enabled: boolean): Promise<void> {
  return invoke("set_shake_enabled", { enabled });
}

export async function triggerTaskEdit(id: number): Promise<void> {
  return invoke("trigger_task_edit", { id });
}

// ─── Compact Mode ──────────────────────────────────────────────────────────────
export async function getCompactMode(): Promise<boolean> {
  return invoke("get_compact_mode");
}

export async function setCompactMode(enabled: boolean): Promise<void> {
  return invoke("set_compact_mode", { enabled });
}

export async function getDisplayMode(): Promise<string> {
  return invoke("get_display_mode");
}

export async function enableEdgePeek(): Promise<void> {
  return invoke("enable_edge_peek");
}

export async function disableEdgePeek(): Promise<void> {
  return invoke("disable_edge_peek");
}

export async function expandEdgePeek(): Promise<void> {
  return invoke("expand_edge_peek");
}

export async function collapseEdgePeek(): Promise<void> {
  return invoke("collapse_edge_peek");
}

// ─── Zen Mode ─────────────────────────────────────────────────────────────────
export async function setZenMode(hidden: boolean): Promise<void> {
  return invoke("set_zen_mode", { hidden });
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

// ─── Daily Digest Commands ──────────────────────────────────────────────────

export interface DigestData {
  overdue: number;
  due_today: number;
  unfinished_yesterday: number;
  total_active: number;
}

export async function getDailyDigest(): Promise<DigestData> {
  return invoke<DigestData>("get_daily_digest");
}

// ─── Pre-Schedule Commands ──────────────────────────────────────────────────

export async function addPrescheduledTask(
  title: string,
  body: string,
  scheduledAt: string,
  dueDate: string | null,
  timeLimitMinutes: number | null,
  tags: string | null,
  workspaceId?: number | null,
): Promise<number> {
  return invoke<number>("add_presceduled_task", {
    title,
    body,
    scheduledAt,
    dueDate,
    timeLimitMinutes,
    tags,
    workspaceId: workspaceId ?? null,
  });
}

export async function getPrescheduledTasks(): Promise<Task[]> {
  return invoke<Task[]>("get_presceduled_tasks");
}

// ─── Workspace Task Commands ──────────────────────────────────────────────────

export async function getWorkspaceTasks(workspaceId: number): Promise<Task[]> {
  return invoke<Task[]>("get_workspace_tasks", { workspaceId });
}

export async function getAllWorkspaceTasks(workspaceId: number): Promise<Task[]> {
  return invoke<Task[]>("get_all_workspace_tasks", { workspaceId });
}

// ─── Card Navigation ───────────────────────────────────────────────────────────
export async function getCardPosition(taskId: number): Promise<{ index: number; total: number }> {
  return invoke("get_card_position", { taskId });
}

export async function focusNextCard(taskId: number): Promise<void> {
  return invoke("focus_next_card", { taskId });
}

export async function focusPrevCard(taskId: number): Promise<void> {
  return invoke("focus_prev_card", { taskId });
}

// ─── Snap to Grid ─────────────────────────────────────────────────────────────
export async function snapAllCardsToGrid(): Promise<void> {
  return invoke("snap_all_cards_to_grid");
}

// ─── Workspace Profiles ───────────────────────────────────────────────────────
export interface Workspace {
  id: number;
  name: string;
  state_json: string;
  created_at: string;
}

export async function saveWorkspace(name: string): Promise<number> {
  return invoke("save_workspace", { name });
}

export async function getWorkspaces(): Promise<Workspace[]> {
  return invoke("get_workspaces");
}

export async function loadWorkspace(workspaceId: number): Promise<void> {
  return invoke("load_workspace", { workspaceId });
}

export async function deleteWorkspace(workspaceId: number): Promise<void> {
  return invoke("delete_workspace", { workspaceId });
}

// ─── Onboarding ──────────────────────────────────────────────────────────────
export async function completeOnboarding(): Promise<void> {
  return invoke("complete_onboarding");
}

// ─── Edge Peek ──────────────────────────────────────────────────────────────
export async function getEdgePeekEnabled(): Promise<boolean> {
  return invoke("get_edge_peek_enabled");
}

export async function setEdgePeekEnabled(enabled: boolean): Promise<void> {
  return invoke("set_edge_peek_enabled", { enabled });
}

export async function toggleEdgePeek(): Promise<void> {
  return invoke("toggle_edge_peek");
}


