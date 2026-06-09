import { create } from "zustand";
import type { Task, AppSettings } from "@/lib/tauriCommands";
import {
  getAllTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask as completeTaskCmd,
  uncompleteTask as uncompleteTaskCmd,
  getSettings,
  updateSetting,
  addPrescheduledTask as addPrescheduledTaskCmd,
  getPrescheduledTasks as getPrescheduledTasksCmd,
  getWorkspaceTasks,
} from "@/lib/tauriCommands";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OverlayState {
  // Data
  tasks: Task[];
  workspaceTasks: Record<number, Task[]>;
  scheduledTasks: Task[];
  settings: AppSettings;
  overlayVisible: boolean;

  // UI state
  isLoading: boolean;
  isAddTaskOpen: boolean;
  isSettingsOpen: boolean;
  isPreScheduleOpen: boolean;
  editingTask: Task | null;
  activeTags: string[];
  isPaused: boolean;

  // Actions - Task management
  fetchTasks: () => Promise<void>;
  fetchWorkspaceTasks: (workspaceId: number) => Promise<void>;
  addTask: (
    title: string,
    description: string,
    urgency: Task["urgency"],
    dueTime: string,
    recurrence?: string | null,
    tags?: string,
    timeLimitMinutes?: number | null,
    workspaceId?: number | null,
  ) => Promise<void>;
  editTask: (
    id: number,
    title: string,
    description: string,
    urgency: Task["urgency"],
    dueTime: string,
    recurrence?: string | null,
    tags?: string | null,
    timeLimitMinutes?: number | null,
  ) => Promise<void>;
  removeTask: (id: number) => Promise<void>;
  completeTask: (id: number) => Promise<void>;
  uncompleteTask: (id: number) => Promise<void>;

  // Actions - Pre-scheduled tasks
  fetchScheduledTasks: () => Promise<void>;
  addPrescheduledTask: (
    title: string,
    body: string,
    urgency: string,
    scheduledAt: string,
    dueDate: string | null,
    timeLimitMinutes: number | null,
    tags: string | null,
    workspaceId?: number | null,
  ) => Promise<number>;
  removeScheduledTask: (id: number) => Promise<void>;

  // Actions - Settings
  fetchSettings: () => Promise<void>;
  saveSetting: (key: string, value: string) => Promise<void>;

  // Actions - Tags
  setActiveTags: (tags: string[]) => void;

  // Actions - UI
  setAddTaskOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setPreScheduleOpen: (open: boolean) => void;
  setEditingTask: (task: Task | null) => void;
  setOverlayVisible: (visible: boolean) => void;
  togglePaused: () => void;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useReminderStore = create<OverlayState>()((set, get) => ({
  // Initial state
  tasks: [],
  workspaceTasks: {},
  scheduledTasks: [],
  settings: {
    theme: "dark",
  },
  overlayVisible: false,
  isLoading: false,
  isAddTaskOpen: false,
  isSettingsOpen: false,
  isPreScheduleOpen: false,
  editingTask: null,
  activeTags: [],
  isPaused: false,

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

  fetchWorkspaceTasks: async (workspaceId: number) => {
    try {
      const tasks = await getWorkspaceTasks(workspaceId);
      set((state) => ({
        workspaceTasks: { ...state.workspaceTasks, [workspaceId]: tasks },
      }));
    } catch (error) {
      console.error("Failed to fetch workspace tasks:", error);
    }
  },

  addTask: async (
    title,
    description,
    urgency,
    dueTime,
    recurrence = null,
    tags = "",
    timeLimitMinutes = null,
    workspaceId = null,
  ) => {
    try {
      const newTask = await createTask(
        title,
        description,
        urgency,
        dueTime,
        recurrence,
        tags || null,
        timeLimitMinutes,
        workspaceId,
      );
      if (workspaceId) {
        set((state) => ({
          workspaceTasks: {
            ...state.workspaceTasks,
            [workspaceId]: [...(state.workspaceTasks[workspaceId] || []), newTask].sort(sortTasks),
          },
        }));
      } else {
        set((state) => ({
          tasks: [...state.tasks, newTask].sort(sortTasks),
        }));
      }
    } catch (error) {
      console.error("Failed to create task:", error);
      throw error;
    }
  },

  editTask: async (
    id,
    title,
    description,
    urgency,
    dueTime,
    recurrence = null,
    tags = null,
    timeLimitMinutes = null,
    startedAt = new Date().toISOString(),
  ) => {
    try {
      await updateTask(
        id,
        title,
        description,
        urgency,
        dueTime,
        recurrence,
        tags,
        timeLimitMinutes,
        startedAt,
      );
      const updatedFields = {
        title,
        description,
        urgency: urgency as Task["urgency"],
        due_time: dueTime,
        recurrence,
        tags,
        time_limit_minutes: timeLimitMinutes,
        started_at: startedAt,
      };
      set((state) => {
        // Try global tasks first
        const globalUpdated = state.tasks.map((t) =>
          t.id === id ? { ...t, ...updatedFields } : t,
        );
        // Check if task was workspace-scoped
        const target = state.tasks.find((t) => t.id === id) ||
          Object.values(state.workspaceTasks).flat().find((t) => t.id === id);
        if (target?.workspace_id) {
          const wid = target.workspace_id;
          const wsTasks = state.workspaceTasks[wid] || [];
          return {
            tasks: globalUpdated,
            workspaceTasks: {
              ...state.workspaceTasks,
              [wid]: wsTasks.map((t) => t.id === id ? { ...t, ...updatedFields } : t).sort(sortTasks),
            },
          };
        }
        return { tasks: globalUpdated.sort(sortTasks) };
      });
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

  uncompleteTask: async (id) => {
    try {
      await uncompleteTaskCmd(id);
      set((state) => ({
        tasks: state.tasks.map((t) =>
          t.id === id ? { ...t, completed: false } : t,
        ),
      }));
    } catch (error) {
      console.error("Failed to uncomplete task:", error);
      throw error;
    }
  },

  // ─── Pre-Scheduled Tasks ───────────────────────────────────────────────

  fetchScheduledTasks: async () => {
    try {
      const scheduledTasks = await getPrescheduledTasksCmd();
      set({ scheduledTasks });
    } catch (error) {
      console.error("Failed to fetch pre-scheduled tasks:", error);
    }
  },

  addPrescheduledTask: async (
    title,
    body,
    urgency,
    scheduledAt,
    dueDate,
    timeLimitMinutes,
    tags,
    workspaceId = null,
  ) => {
    try {
      const id = await addPrescheduledTaskCmd(
        title,
        body,
        urgency,
        scheduledAt,
        dueDate,
        timeLimitMinutes,
        tags,
        workspaceId,
      );
      // Refresh the scheduled list so the new entry shows up in the
      // Scheduled section of the main task view immediately.
      const scheduledTasks = await getPrescheduledTasksCmd();
      set({ scheduledTasks });
      return id;
    } catch (error) {
      console.error("Failed to create pre-scheduled task:", error);
      throw error;
    }
  },

  removeScheduledTask: async (id) => {
    try {
      await deleteTask(id);
      set((state) => ({
        scheduledTasks: state.scheduledTasks.filter((t) => t.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete pre-scheduled task:", error);
      throw error;
    }
  },

  // ─── Settings ──────────────────────────────────────────────────────────

  fetchSettings: async () => {
    try {
      const settings = await getSettings();
      set({ settings });
      stopSystemTheme();
      applyTheme(settings.theme);
      if (settings.theme === "system") listenSystemTheme();
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  },

  saveSetting: async (key, value) => {
    try {
      await updateSetting(key, value);
      const { settings } = get();
      const updated: AppSettings =
        key === "theme"
          ? { ...settings, theme: value as AppSettings["theme"] }
          : settings;
      set({ settings: updated });
      if (key === "theme") {
        stopSystemTheme();
        applyTheme(value);
        if (value === "system") listenSystemTheme();
      }
    } catch (error) {
      console.error("Failed to save setting:", error);
      throw error;
    }
  },

  // ─── Tags ──────────────────────────────────────────────────────────────

  setActiveTags: (tags) => set({ activeTags: tags }),

  // ─── UI ────────────────────────────────────────────────────────────────

  setAddTaskOpen: (open: boolean) => set({ isAddTaskOpen: open, editingTask: open ? get().editingTask : null }),
  setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
  setPreScheduleOpen: (open: boolean) => set({ isPreScheduleOpen: open }),
  setEditingTask: (task: Task | null) => set({ editingTask: task, isAddTaskOpen: !!task }),
  setOverlayVisible: (visible) => set({ overlayVisible: visible }),
  togglePaused: () => set((state) => ({ isPaused: !state.isPaused })),
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

let mediaListener: (() => void) | null = null;

function listenSystemTheme(): void {
  if (mediaListener) mediaListener();
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    const root = document.documentElement;
    if (e.matches) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  };
  mq.addEventListener("change", handler);
  mediaListener = () => mq.removeEventListener("change", handler);
}

function stopSystemTheme(): void {
  if (mediaListener) {
    mediaListener();
    mediaListener = null;
  }
}
