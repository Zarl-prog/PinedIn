import { useEffect } from "react";
import { motion } from "framer-motion";
import TaskList from "@/components/TaskList";
import AddTaskModal from "@/components/AddTaskModal";
import SettingsPanel from "@/components/SettingsPanel";
import TrayMenu from "@/components/TrayMenu";
import { useReminders } from "@/hooks/useReminders";
import { useReminderStore } from "@/store/reminderStore";

/**
 * PinedIn - Main application window.
 * Full task management UI with add/edit/delete/complete operations.
 */
export default function App() {
  // Initialize event listeners and fetch tasks/settings
  useReminders();

  const isAddTaskOpen = useReminderStore((s) => s.isAddTaskOpen);
  const setAddTaskOpen = useReminderStore((s) => s.setAddTaskOpen);
  const isSettingsOpen = useReminderStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useReminderStore((s) => s.setSettingsOpen);
  const editingTask = useReminderStore((s) => s.editingTask);
  const setEditingTask = useReminderStore((s) => s.setEditingTask);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isAddTaskOpen) {
          setAddTaskOpen(false);
          setEditingTask(null);
        }
        if (isSettingsOpen) setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddTaskOpen, isSettingsOpen, setAddTaskOpen, setSettingsOpen, setEditingTask]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased">
      {/* Main content */}
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/20">
              <img
                src="/pinedin-icon.png"
                alt="PinedIn"
                className="h-7 w-7"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                PinedIn
              </h1>
              <p className="text-xs text-muted-foreground">
                Persistent task overlay
              </p>
            </div>
          </div>

          {/* Tray Menu */}
          <TrayMenu />
        </motion.header>

        {/* Main Task List */}
        <motion.main
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex-1"
        >
          <TaskList />
        </motion.main>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="mt-8 border-t border-border/30 pt-4 text-center text-xs text-muted-foreground/40"
        >
          PinedIn v0.1.0 — Always-on-task overlay
        </motion.footer>
      </div>

      {/* Modals */}
      <AddTaskModal
        open={isAddTaskOpen}
        onClose={() => {
          setAddTaskOpen(false);
          setEditingTask(null);
        }}
        editTask={editingTask}
      />

      <SettingsPanel
        open={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
