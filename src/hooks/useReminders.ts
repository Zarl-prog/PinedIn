import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useReminderStore } from "@/store/reminderStore";

/**
 * Hook that listens for Tauri events for task updates.
 * Refreshes the task list whenever tasks change.
 */
export function useReminders() {
  const fetchTasks = useReminderStore.getState().fetchTasks;
  const fetchScheduledTasks = useReminderStore.getState().fetchScheduledTasks;

  useEffect(() => {
    let mounted = true;
    let unlisten1: (() => void) | null = null;
    let unlisten2: (() => void) | null = null;

    const l1 = listen("tasks-updated", () => {
      if (!mounted) return;
      fetchTasks();
      fetchScheduledTasks();
    });
    const l2 = listen("open-quick-task", () => {
      if (!mounted) return;
      useReminderStore.getState().setAddTaskOpen(true);
    });

    Promise.all([l1, l2]).then(([u1, u2]) => {
      unlisten1 = u1;
      unlisten2 = u2;
    });

    fetchTasks();
    fetchScheduledTasks();

    return () => {
      mounted = false;
      unlisten1?.();
      unlisten2?.();
    };
  }, []);
}
