import { useEffect } from "react";
import { motion } from "framer-motion";
import { Bell, Pin } from "lucide-react";
import TaskList from "@/components/TaskList";
import AddTaskModal from "@/components/AddTaskModal";
import SettingsPanel from "@/components/SettingsPanel";
import ReminderPopup from "@/components/ReminderPopup";
import TrayMenu from "@/components/TrayMenu";
import { useReminders } from "@/hooks/useReminders";
import { useReminderStore } from "@/store/reminderStore";

/**
 * PinedIn - Main application component.
 *
 * Layout:
 * - Top tray bar with controls
 * - Task list (main content)
 * - Floating reminder popups (always-on-top)
 * - Modals for adding/editing tasks and settings
 */
export default function App() {
  // Initialize reminders listener and settings
  useReminders();

  const isAddTaskOpen = useReminderStore((s) => s.isAddTaskOpen);
  const setAddTaskOpen = useReminderStore((s) => s.setAddTaskOpen);
  const isSettingsOpen = useReminderStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useReminderStore((s) => s.setSettingsOpen);
  const editingTask = useReminderStore((s) => s.editingTask);
  const setEditingTask = useReminderStore((s) => s.setEditingTask);
  const activePopups = useReminderStore((s) => s.activePopups);
  const remindersPaused = useReminderStore((s) => s.remindersPaused);

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
      {/* Reminder popups - rendered outside main content for z-index */}
      <ReminderPopup />

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
              <Pin className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                PinedIn
              </h1>
              <p className="text-xs text-muted-foreground">
                Focus reminder system
              </p>
            </div>
            {remindersPaused && (
              <div className="ml-auto flex items-center gap-1.5 rounded-full bg-urgency-medium/15 px-3 py-1 text-xs font-medium text-urgency-medium">
                <Bell className="h-3 w-3" />
                Paused
              </div>
            )}
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
          {/* Active popups indicator */}
          {activePopups.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="mb-4"
            >
              <div className="flex items-center gap-2 rounded-xl border border-urgency-critical/30 bg-urgency-critical/5 p-3">
                <Bell className="h-4 w-4 shrink-0 text-urgency-critical" />
                <span className="text-sm font-medium text-foreground">
                  {activePopups.length} active reminder
                  {activePopups.length !== 1 ? "s" : ""}
                </span>
              </div>
            </motion.div>
          )}

          <TaskList />
        </motion.main>

        {/* Footer */}
        <motion.footer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="mt-8 border-t border-border/30 pt-4 text-center text-xs text-muted-foreground/40"
        >
          PinedIn v0.1.0 — Always-on-top reminders
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
