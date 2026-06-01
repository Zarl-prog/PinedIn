import { useEffect, useRef } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useReminderStore } from "@/store/reminderStore";
import type { Task } from "@/lib/tauriCommands";

interface ReminderDuePayload {
  task: Task;
  is_re_trigger: boolean;
  timestamp: string;
}

interface RemindersDueBulkPayload {
  tasks: Task[];
  count: number;
  timestamp: string;
}

interface RemindersPausedPayload {
  paused: boolean;
}

/**
 * Hook that listens for Tauri events for due reminders.
 * Automatically shows popups when tasks are due.
 * Handles re-trigger logic with increasing visual intensity.
 */
export function useReminders() {
  const showPopup = useReminderStore((s) => s.showPopup);
  const fetchTasks = useReminderStore((s) => s.fetchTasks);
  const setRemindersPaused = useReminderStore((s) => s.setRemindersPaused);

  useEffect(() => {
    const unlisteners: UnlistenFn[] = [];
    let mounted = true;

    async function setup() {
      const unlisten1 = await listen<ReminderDuePayload>(
        "reminder-due",
        (event) => {
          if (!mounted) return;
          const { task, is_re_trigger } = event.payload;
          showPopup(task, is_re_trigger);
        },
      );
      unlisteners.push(unlisten1);

      const unlisten2 = await listen<RemindersDueBulkPayload>(
        "reminders-due-bulk",
        (event) => {
          if (!mounted) return;
          const { tasks } = event.payload;
          for (const task of tasks) {
            showPopup(task, false);
          }
        },
      );
      unlisteners.push(unlisten2);

      const unlisten3 = await listen<RemindersPausedPayload>(
        "reminders-paused",
        (event) => {
          if (!mounted) return;
          setRemindersPaused(event.payload.paused);
          if (event.payload.paused) {
            useReminderStore.getState().dismissAllPopups();
          }
        },
      );
      unlisteners.push(unlisten3);

      const unlisten4 = await listen("open-quick-task", () => {
        if (!mounted) return;
        useReminderStore.getState().setAddTaskOpen(true);
      });
      unlisteners.push(unlisten4);
    }

    setup();
    fetchTasks();

    const interval = setInterval(() => {
      if (mounted) fetchTasks();
    }, 30000);

    return () => {
      mounted = false;
      for (const unlisten of unlisteners) {
        unlisten();
      }
      clearInterval(interval);
    };
  }, [showPopup, fetchTasks, setRemindersPaused]);
}
