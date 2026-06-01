import { create } from "zustand";
import type { Task, AppSettings } from "@/lib/tauriCommands";
import {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask as completeTaskCmd,
  snoozeTask as snoozeTaskCmd,
  getSettings,
  updateSetting,
} from "@/lib/tauriCommands";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ActivePopup {
  taskId: number;
  task: Task;
  isReTrigger: boolean;
  shownAt: string;
}

export interface ReminderState {
  // Data
  tasks: Task[];
  activePopups: ActivePopup[];
  settings: AppSettings;
  remindersPaused: boolean;

  // UI state
  isLoading: boolean;
  isAddTaskOpen: boolean;
  isSettingsOpen: boolean;
  editingTask: Task | null;

  // Actions - Task management
  fetchTasks: () => Promise<void>;
  addTask: (
    title: string,
    description: string,
    urgency: Task['urgency'],
    dueTime: string,
    repeat: boolean,
  ) => Promise<void>;
  editTask: (
    id: number,
    title: string,
    description: string,
    urgency: Task['urgency'],
    dueTime: string,
    repeat: boolean,
  ) => Promise<void>;
  removeTask: (id: number) => Promise<void>;
  completeTask: (id: number) => Promise<void>;
  snoozeTaskAction: (id: number, minutes: number) => Promise<void>;

  // Actions - Popups
  showPopup: (task: Task, isReTrigger?: boolean) => void;
  dismissPopup: (taskId: number) => void;
  dismissAllPopups: () => void;

  // Actions - Settings
  fetchSettings: () => Promise<void>;
  saveSetting: (key: string, value: string) => Promise<void>;

  // Actions - UI
  setAddTaskOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setEditingTask: (task: Task | null) => void;
  setRemindersPaused: (paused: boolean) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useReminderStore = create<ReminderState>()((set, get) => ({
  // Initial state
  tasks: [],
  activePopups: [],
  settings: {
    default_snooze_minutes: 10,
    start_on_boot: false,
    sound_enabled: true,
    theme: "dark",
    quiet_hours_start: null,
    quiet_hours_end: null,
  },
  remindersPaused: false,
  isLoading: false,
  isAddTaskOpen: false,
  isSettingsOpen: false,
  editingTask: null,

  // ─── Task Management ──────────────────────────────────────────────────

  fetchTasks: async () => {
    set({ isLoading: true });
    try {
      const tasks = await getAllTasks();
      set({ tasks, isLoading: false });
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      set({ isLoading: false });
    }
  },

  addTask: async (title, description, urgency, dueTime, repeat) => {
    try {
      const newTask = await createTask(
        title,
        description,
        urgency,
        dueTime,
        repeat,
      );
      set((state) => ({
        tasks: [...state.tasks, newTask].sort(sortTasks),
      }));
    } catch (error) {
      console.error("Failed to create task:", error);
      throw error;
    }
  },

  editTask: async (id, title, description, urgency, dueTime, repeat) => {
    try {
      await updateTask(id, title, description, urgency, dueTime, repeat);
      set((state) => ({
        tasks: state.tasks
          .map((t) =>
            t.id === id
              ? { ...t, title, description, urgency: urgency as Task['urgency'], due_time: dueTime, repeat }
              : t,
          )
          .sort(sortTasks),
      }));
    } catch (error) {
      console.error("Failed to update task:", error);
      throw error;
    }
  },

  removeTask: async (id) => {
    try {
      await deleteTask(id);
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
        activePopups: state.activePopups.filter((p) => p.taskId !== id),
      }));
    } catch (error) {
      console.error("Failed to delete task:", error);
      throw error;
    }
  },

  completeTask: async (id) => {
    try {
      await completeTaskCmd(id);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, completed: true } : t,
        ),
        activePopups: state.activePopups.filter((p) => p.taskId !== id),
      }));
    } catch (error) {
      console.error("Failed to complete task:", error);
      throw error;
    }
  },

  snoozeTaskAction: async (id, minutes) => {
    try {
      await snoozeTaskCmd(id, minutes);
      // Remove the popup and update the task's snooze count locally
      set((state) => ({
        activePopups: state.activePopups.filter((p) => p.taskId !== id),
        tasks: state.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                snooze_count: t.snooze_count + 1,
                due_time: new Date(
                  Date.now() + minutes * 60 * 1000,
                ).toISOString(),
              }
            : t,
        ),
      }));
    } catch (error) {
      console.error("Failed to snooze task:", error);
      throw error;
    }
  },

  // ─── Popups ────────────────────────────────────────────────────────────

  showPopup: (task, isReTrigger = false) => {
    const taskId = task.id ?? 0;
    const { activePopups } = get();

    // Don't add duplicate popups
    if (activePopups.some((p) => p.taskId === taskId)) {
      // Update the existing popup to mark it as re-triggered
      set((state) => ({
        activePopups: state.activePopups.map((p) =>
          p.taskId === taskId ? { ...p, isReTrigger: p.isReTrigger || isReTrigger } : p,
        ),
      }));
      return;
    }

    const popup: ActivePopup = {
      taskId,
      task,
      isReTrigger,
      shownAt: new Date().toISOString(),
    };

    set((state) => ({
      activePopups: [...state.activePopups, popup],
    }));
  },

  dismissPopup: (taskId) => {
    set((state) => ({
      activePopups: state.activePopups.filter((p) => p.taskId !== taskId),
    }));
  },

  dismissAllPopups: () => {
    set({ activePopups: [] });
  },

  // ─── Settings ──────────────────────────────────────────────────────────

  fetchSettings: async () => {
    try {
      const settings = await getSettings();
      set({ settings });
      // Apply theme
      applyTheme(settings.theme);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  },

  saveSetting: async (key, value) => {
    try {
      await updateSetting(key, value);
      // Update local state
      const { settings } = get();
      const updated = { ...settings, [key]: value };
      set({ settings: updated as AppSettings });

      // Apply theme if it changed
      if (key === "theme") {
        applyTheme(value);
      }
    } catch (error) {
      console.error("Failed to save setting:", error);
      throw error;
    }
  },

  // ─── UI ────────────────────────────────────────────────────────────────

  setAddTaskOpen: (open) => set({ isAddTaskOpen: open, editingTask: open ? get().editingTask : null }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setEditingTask: (task) => set({ editingTask: task, isAddTaskOpen: !!task }),
  setRemindersPaused: (paused) => set({ remindersPaused: paused }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sortTasks(a: Task, b: Task): number {
  const urgencyOrder = { critical: 0, medium: 1, low: 2 };
  const aOrder = urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 3;
  const bOrder = urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 3;

  if (aOrder !== bOrder) return aOrder - bOrder;
  return new Date(a.due_time).getTime() - new Date(b.due_time).getTime();
}

function applyTheme(theme: string): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // system
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}
