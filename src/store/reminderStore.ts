import { create } from "zustand";
import type { AppSettings, Task } from "@/lib/tauriCommands";
import {
  addPrescheduledTask as addPrescheduledTaskCmd,
  completeTask as completeTaskCmd,
  createTask,
  deleteTask,
  getAllTasks,
  getAllWorkspaceTasks,
  getPrescheduledTasks as getPrescheduledTasksCmd,
  getSettings,
  uncompleteTask as uncompleteTaskCmd,
  updateSetting,
  updateTask,
} from "@/lib/tauriCommands";
import { applyTheme, listenSystemTheme, stopSystemTheme } from "@/lib/theme";
import { sortTasks } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UndoEntry {
  action: "delete" | "complete";
  task: Task;
}

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
  isCustomizeOpen: boolean;
  isPreScheduleOpen: boolean;
  isMcpOpen: boolean;
  editingTask: Task | null;
  activeTags: string[];
  isPaused: boolean;
  undoEntry: UndoEntry | null;

  // Actions - Task management
  fetchTasks: () => Promise<void>;
  fetchWorkspaceTasks: (workspaceId: number) => Promise<void>;
  addTask: (
    title: string,
    description: string,
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
    dueTime: string,
    recurrence?: string | null,
    tags?: string | null,
    timeLimitMinutes?: number | null,
    startedAt?: string | null,
  ) => Promise<void>;
  removeTask: (id: number) => Promise<void>;
  completeTask: (id: number) => Promise<void>;
  uncompleteTask: (id: number) => Promise<void>;

  // Actions - Pre-scheduled tasks
  fetchScheduledTasks: () => Promise<void>;
  addPrescheduledTask: (
    title: string,
    body: string,
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
  setMcpOpen: (open: boolean) => void;
  setPreScheduleOpen: (open: boolean) => void;
  setCustomizeOpen: (open: boolean) => void;
  setEditingTask: (task: Task | null) => void;
  setOverlayVisible: (visible: boolean) => void;
  togglePaused: () => void;
  pushUndo: (entry: UndoEntry) => void;
  clearUndo: () => void;
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
  isCustomizeOpen: false,
  isMcpOpen: false,
  editingTask: null,
  activeTags: [],
  isPaused: false,
  undoEntry: null,

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
      const tasks = await getAllWorkspaceTasks(workspaceId);
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
    dueTime,
    recurrence = null,
    tags = null,
    timeLimitMinutes = null,
    startedAt = null,
  ) => {
    try {
      // Resolve startedAt: use explicit value if provided, otherwise
      // keep the existing started_at from the store so editing title/
      // description doesn't reset the task timer.
      // resolve startedAt using the get() function from zustand's store context
      const existingTask =
        get().tasks.find((t) => t.id === id) ||
        Object.values(get().workspaceTasks)
          .flat()
          .find((t) => t.id === id);

      let resolvedStartedAt: string | null = startedAt;
      if (resolvedStartedAt === null) {
        if (timeLimitMinutes && !existingTask?.started_at) {
          // Timer newly enabled — start it now
          resolvedStartedAt = new Date().toISOString();
        } else {
          // Preserve existing started_at (may be null if no timer)
          resolvedStartedAt = existingTask?.started_at ?? null;
        }
      }
      await updateTask(
        id,
        title,
        description,
        dueTime,
        recurrence,
        tags,
        timeLimitMinutes,
        resolvedStartedAt,
      );
      const updatedFields = {
        title,
        description,
        due_time: dueTime,
        recurrence,
        tags,
        time_limit_minutes: timeLimitMinutes,
        started_at: resolvedStartedAt,
      };
      set((state) => {
        // Try global tasks first
        const globalUpdated = state.tasks.map((t) =>
          t.id === id ? { ...t, ...updatedFields } : t,
        );
        // Check if task was workspace-scoped
        const target =
          state.tasks.find((t) => t.id === id) ||
          Object.values(state.workspaceTasks)
            .flat()
            .find((t) => t.id === id);
        if (target?.workspace_id) {
          const wid = target.workspace_id;
          const wsTasks = state.workspaceTasks[wid] || [];
          return {
            tasks: globalUpdated,
            workspaceTasks: {
              ...state.workspaceTasks,
              [wid]: wsTasks
                .map((t) => (t.id === id ? { ...t, ...updatedFields } : t))
                .sort(sortTasks),
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
    const target =
      get().tasks.find((t) => t.id === id) ||
      Object.values(get().workspaceTasks)
        .flat()
        .find((t) => t.id === id);
    try {
      await deleteTask(id);
      if (target) {
        get().pushUndo({ action: "delete", task: target });
      }
      set((state) => {
        if (target?.workspace_id) {
          const wid = target.workspace_id;
          const wsTasks = state.workspaceTasks[wid] || [];
          return {
            tasks: state.tasks.filter((t) => t.id !== id),
            workspaceTasks: {
              ...state.workspaceTasks,
              [wid]: wsTasks.filter((t) => t.id !== id),
            },
          };
        }
        return { tasks: state.tasks.filter((t) => t.id !== id) };
      });
    } catch (error) {
      console.error("Failed to delete task:", error);
      throw error;
    }
  },

  completeTask: async (id) => {
    let workspaceId: number | null = null;
    try {
      const target =
        get().tasks.find((t) => t.id === id) ||
        Object.values(get().workspaceTasks)
          .flat()
          .find((t) => t.id === id);
      await completeTaskCmd(id);
      if (target) {
        get().pushUndo({ action: "complete", task: target });
        workspaceId = target.workspace_id ?? null;
      }
      // Update both tasks and workspaceTasks if workspace-scoped (original behavior)
      set((state) => {
        if (workspaceId !== null) {
          const wid = workspaceId;
          const wsTasks = state.workspaceTasks[wid] || [];
          return {
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: true } : t)),
            workspaceTasks: {
              ...state.workspaceTasks,
              [wid]: wsTasks.map((t) => (t.id === id ? { ...t, completed: true } : t)),
            },
          };
        }
        return {
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: true } : t)),
        };
      });
    } catch (error) {
      console.error("Failed to complete task:", error);
      throw error;
    }
  },

  uncompleteTask: async (id) => {
    let workspaceId: number | null = null;
    try {
      const target =
        get().tasks.find((t) => t.id === id) ||
        Object.values(get().workspaceTasks)
          .flat()
          .find((t) => t.id === id);
      workspaceId = target?.workspace_id ?? null;
      await uncompleteTaskCmd(id);
      set((state) => {
        if (workspaceId !== null) {
          const wid = workspaceId;
          const wsTasks = state.workspaceTasks[wid] || [];
          return {
            tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: false } : t)),
            workspaceTasks: {
              ...state.workspaceTasks,
              [wid]: wsTasks.map((t) => (t.id === id ? { ...t, completed: false } : t)),
            },
          };
        }
        return {
          tasks: state.tasks.map((t) => (t.id === id ? { ...t, completed: false } : t)),
        };
      });
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
        key === "theme" ? { ...settings, theme: value as AppSettings["theme"] } : settings;
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

  setAddTaskOpen: (open: boolean) =>
    set({ isAddTaskOpen: open, editingTask: open ? get().editingTask : null }),
  setSettingsOpen: (open: boolean) => set({ isSettingsOpen: open }),
  setMcpOpen: (open: boolean) => set({ isMcpOpen: open }),
  setPreScheduleOpen: (open: boolean) => set({ isPreScheduleOpen: open }),
  setCustomizeOpen: (open: boolean) => set({ isCustomizeOpen: open }),
  setEditingTask: (task: Task | null) => set({ editingTask: task, isAddTaskOpen: !!task }),
  setOverlayVisible: (visible) => set({ overlayVisible: visible }),
  togglePaused: () => set((state) => ({ isPaused: !state.isPaused })),
  pushUndo: (entry) => set({ undoEntry: entry }),
  clearUndo: () => set({ undoEntry: null }),
}));
