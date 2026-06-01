import { motion } from "framer-motion";
import {
  Plus,
  Settings,
} from "lucide-react";
import { useReminderStore } from "@/store/reminderStore";

/**
 * TrayMenu - Quick-access controls within the app.
 * Provides Add Task and Settings buttons.
 */
export default function TrayMenu() {
  const setAddTaskOpen = useReminderStore((s) => s.setAddTaskOpen);
  const setSettingsOpen = useReminderStore((s) => s.setSettingsOpen);

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
