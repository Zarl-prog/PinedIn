import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useReminderStore } from "@/store/reminderStore";

/**
 * Hook that listens for Tauri events for task updates.
 * Refreshes the task list whenever tasks change.
 */
export function useReminders() {
  const fetchTasks = useReminderStore((s) => s.fetchTasks);
  const fetchScheduledTasks = useReminderStore((s) => s.fetchScheduledTasks);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];
    let mounted = true;

    async function setup() {
      // Listen for tasks-updated events emitted from Rust backend
      const unlisten1 = await listen("tasks-updated", () => {
        if (!mounted) return;
        fetchTasks();
        // Also refresh the scheduled list. The Rust backend already
        // excludes pre-scheduled tasks from get_all_tasks, so this
        // gives the main Scheduled section its own independent view.
        fetchScheduledTasks();
      });
      unlisteners.push(unlisten1);

      // Listen for quick task shortcut from tray
      const unlisten2 = await listen("open-quick-task", () => {
        if (!mounted) return;
        useReminderStore.getState().setAddTaskOpen(true);
      });
      unlisteners.push(unlisten2);
    }

    setup();
    fetchTasks();
    fetchScheduledTasks();

    return () => {
      mounted = false;
      for (const unlisten of unlisteners) {
        unlisten();
      }
    };
  }, [fetchTasks, fetchScheduledTasks]);
}
