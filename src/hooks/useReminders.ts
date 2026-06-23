import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useReminderStore } from "@/store/reminderStore";

/**
 * Hook that listens for Tauri events for task updates.
 * Refreshes the task list whenever tasks change.
 */
export function useReminders() {
  // Stable action refs — don't cause effect re-runs
  const fetchTasks = useReminderStore.getState().fetchTasks;
  const fetchScheduledTasks = useReminderStore.getState().fetchScheduledTasks;

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];
    let mounted = true;

    async function setup() {
      const unlisten1 = await listen("tasks-updated", () => {
        if (!mounted) return;
        fetchTasks();
        fetchScheduledTasks();
      });
      unlisteners.push(unlisten1);

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
  }, []); // stable refs — no deps needed
}
