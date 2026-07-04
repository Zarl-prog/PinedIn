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
    let mounted = true;
    const setupPromise = Promise.all([
      listen("tasks-updated", () => {
        if (!mounted) return;
        fetchTasks();
        fetchScheduledTasks();
      }),
      listen("open-quick-task", () => {
        if (!mounted) return;
        useReminderStore.getState().setAddTaskOpen(true);
      }),
    ]);

    fetchTasks();
    fetchScheduledTasks();

    return () => {
      mounted = false;
      setupPromise.then(([u1, u2]) => {
        u1();
        u2();
      });
    };
  }, []);
}
