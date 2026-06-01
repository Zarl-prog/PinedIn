import { motion } from "framer-motion";
import {
  Plus,
  Pause,
  Play,
  Settings,
  Bell,
} from "lucide-react";
import { useReminderStore } from "@/store/reminderStore";
import { togglePauseReminders } from "@/lib/tauriCommands";
import { cn } from "@/lib/utils";

/**
 * TrayMenu - In-app representation of the system tray controls.
 * While the actual tray lives in the OS system tray, this component
 * provides quick-access controls within the app for convenience.
 */
export default function TrayMenu() {
  const remindersPaused = useReminderStore((s) => s.remindersPaused);
  const setRemindersPaused = useReminderStore((s) => s.setRemindersPaused);
  const setAddTaskOpen = useReminderStore((s) => s.setAddTaskOpen);
  const setSettingsOpen = useReminderStore((s) => s.setSettingsOpen);
  const activePopups = useReminderStore((s) => s.activePopups);

  const handleTogglePause = async () => {
    try {
      const newState = await togglePauseReminders();
      setRemindersPaused(newState);
    } catch (error) {
      console.error("Failed to toggle pause:", error);
    }
  };

  return (
    <div className="flex items-center gap-1 rounded-xl border border-border/50 bg-card p-1.5 shadow-sm">
      {/* Quick Add */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setAddTaskOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        <Plus className="h-3.5 w-3.5" />
        Quick Add
      </motion.button>

      <div className="h-6 w-px bg-border/50" />

      {/* Pause/Resume */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleTogglePause}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors",
          remindersPaused
            ? "text-urgency-medium hover:bg-urgency-medium/10"
            : "text-foreground hover:bg-muted",
        )}
      >
        {remindersPaused ? (
          <>
            <Play className="h-3.5 w-3.5" />
            Resume
          </>
        ) : (
          <>
            <Pause className="h-3.5 w-3.5" />
            Pause
          </>
        )}
      </motion.button>

      {/* Active popups indicator */}
      {activePopups.length > 0 && (
        <>
          <div className="h-6 w-px bg-border/50" />
          <div className="flex items-center gap-1.5 rounded-lg bg-urgency-critical/10 px-3 py-2">
            <Bell className="h-3.5 w-3.5 text-urgency-critical" />
            <span className="text-xs font-medium text-urgency-critical">
              {activePopups.length} active
            </span>
          </div>
        </>
      )}

      <div className="h-6 w-px bg-border/50" />

      {/* Settings */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setSettingsOpen(true)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted"
      >
        <Settings className="h-3.5 w-3.5" />
        Settings
      </motion.button>
    </div>
  );
}
