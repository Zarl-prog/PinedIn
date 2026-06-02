import { useEffect } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
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
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased border border-primary/20 rounded-xl overflow-hidden ring-1 ring-primary/10">
      {/* Custom title bar */}
      <div
        data-tauri-drag-region
        className="flex h-9 shrink-0 items-center justify-between border-b border-border/20 bg-background/80 px-3"
      >
        <div data-tauri-drag-region className="flex items-center gap-2 select-none">
          <img src="/pinedin-icon.png" alt="" className="h-4 w-4 opacity-70" />
          <span className="text-xs font-medium text-muted-foreground/60">PinedIn</span>
        </div>
        <div className="flex items-center gap-1">
          {/* Minimize */}
          <button
            onClick={() => getCurrentWindow().minimize()}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
            title="Minimize"
          >
            <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor"><rect width="10" height="1.5" rx="0.75"/></svg>
          </button>
          {/* Maximize/Restore */}
          <button
            onClick={() => getCurrentWindow().toggleMaximize()}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
            title="Maximize"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="0.75" y="0.75" width="8.5" height="8.5" rx="1"/></svg>
          </button>
          {/* Close */}
          <button
            onClick={() => getCurrentWindow().close()}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-destructive hover:text-white"
            title="Close"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
          </button>
        </div>
      </div>
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
