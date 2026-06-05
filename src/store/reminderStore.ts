import { create } from "zustand";
import type { Task, AppSettings } from "@/lib/tauriCommands";
import {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask as completeTaskCmd,
  getSettings,
  updateSetting,
} from "@/lib/tauriCommands";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OverlayState {
  // Data
  tasks: Task[];
  settings: AppSettings;
  overlayVisible: boolean;

  // UI state
  isLoading: boolean;
  isAddTaskOpen: boolean;
  isSettingsOpen: boolean;
  editingTask: Task | null;
  activeTags: string[];

  // Actions - Task management
  fetchTasks: () => Promise<void>;
  addTask: (
    title: string,
    description: string,
    urgency: Task["urgency"],
    dueTime: string,
    recurrence?: string | null,
    tags?: string,
  ) => Promise<void>;
  editTask: (
    id: number,
    title: string,
    description: string,
    urgency: Task["urgency"],
    dueTime: string,
  ) => Promise<void>;
  removeTask: (id: number) => Promise<void>;
  completeTask: (id: number) => Promise<void>;

  // Actions - Settings
  fetchSettings: () => Promise<void>;
  saveSetting: (key: string, value: string) => Promise<void>;

  // Actions - Tags
  setActiveTags: (tags: string[]) => void;

  // Actions - UI
  setAddTaskOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setEditingTask: (task: Task | null) => void;
  setOverlayVisible: (visible: boolean) => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useReminderStore = create<OverlayState>()((set, get) => ({
  // Initial state
  tasks: [],
  settings: {
    theme: "dark",
  },
  overlayVisible: false,
  isLoading: false,
  isAddTaskOpen: false,
  isSettingsOpen: false,
  editingTask: null,
  activeTags: [],

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

  addTask: async (title, description, urgency, dueTime, recurrence = null, tags = "") => {
    try {
      const newTask = await createTask(title, description, urgency, dueTime, recurrence, tags || null);
      set((state) => ({
        tasks: [...state.tasks, newTask].sort(sortTasks),
      }));
    } catch (error) {
      console.error("Failed to create task:", error);
      throw error;
    }
  },

  editTask: async (id, title, description, urgency, dueTime) => {
    try {
      await updateTask(id, title, description, urgency, dueTime);
      set((state) => ({
        tasks: state.tasks
          .map((t) =>
            t.id === id
              ? { ...t, title, description, urgency: urgency as Task["urgency"], due_time: dueTime }
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
      }));
    } catch (error) {
      console.error("Failed to complete task:", error);
      throw error;
    }
  },

  // ─── Settings ──────────────────────────────────────────────────────────

  fetchSettings: async () => {
    try {
      const settings = await getSettings();
      set({ settings });
      applyTheme(settings.theme);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  },

  saveSetting: async (key, value) => {
    try {
      await updateSetting(key, value);
      const { settings } = get();
      const updated = { ...settings, [key]: value };
      set({ settings: updated as AppSettings });
      if (key === "theme") {
        applyTheme(value);
      }
    } catch (error) {
      console.error("Failed to save setting:", error);
      throw error;
    }
  },

  // ─── Tags ──────────────────────────────────────────────────────────────

  setActiveTags: (tags) => set({ activeTags: tags }),

  // ─── UI ────────────────────────────────────────────────────────────────

  setAddTaskOpen: (open) => set({ isAddTaskOpen: open, editingTask: open ? get().editingTask : null }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setEditingTask: (task) => set({ editingTask: task, isAddTaskOpen: !!task }),
  setOverlayVisible: (visible) => set({ overlayVisible: visible }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sortTasks(a: Task, b: Task): number {
  const urgencyOrder = { critical: 0, medium: 1, low: 2 };
  const aOrder = urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 3;
  const bOrder = urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 3;

  if (aOrder !== bOrder) return aOrder - bOrder;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

function applyTheme(theme: string): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
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
