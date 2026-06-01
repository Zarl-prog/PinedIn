import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, BellOff, Clock, AlertTriangle } from "lucide-react";
import UrgencyBadge from "./UrgencyBadge";
import { useReminderStore, type ActivePopup } from "@/store/reminderStore";
import { cn } from "@/lib/utils";

/**
 * ReminderPopup - Always-on-top animated popup for due reminders.
 * Appears from top-right with slide+fade animation.
 * Critical popups shake and pulse with red border.
 * Supports stacking multiple popups.
 */
export default function ReminderPopup() {
  const activePopups = useReminderStore((s) => s.activePopups);
  const dismissPopup = useReminderStore((s) => s.dismissPopup);
  const completeTask = useReminderStore((s) => s.completeTask);
  const snoozeTaskAction = useReminderStore((s) => s.snoozeTaskAction);
  const settings = useReminderStore((s) => s.settings);

  if (activePopups.length === 0) return null;

  return (
    <div className="fixed right-4 top-4 z-[9999] flex flex-col gap-3">
      <AnimatePresence mode="popLayout">
        {activePopups.map((popup, index) => (
          <PopupCard
            key={popup.taskId}
            popup={popup}
            index={index}
            onDismiss={() => dismissPopup(popup.taskId)}
            onComplete={() => completeTask(popup.taskId)}
            onSnooze={(mins) => snoozeTaskAction(popup.taskId, mins)}
            defaultSnooze={settings.default_snooze_minutes}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface PopupCardProps {
  popup: ActivePopup;
  index: number;
  onDismiss: () => void;
  onComplete: () => void;
  onSnooze: (minutes: number) => void;
  defaultSnooze: number;
}

function PopupCard({
  popup,
  index,
  onDismiss,
  onComplete,
  onSnooze,
  defaultSnooze,
}: PopupCardProps) {
  const { task, isReTrigger } = popup;
  const isCritical = task.urgency === "critical";
  const canSnooze = !isCritical || task.snooze_count < 2;

  // Format time remaining
  const timeRemaining = getTimeRemaining(task.due_time);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{
        opacity: 1,
        x: 0,
        scale: 1,
        ...(isCritical && isReTrigger
          ? {
              x: [0, -4, 4, -4, 4, -4, 4, 0],
              transition: { duration: 0.5, repeat: Infinity, repeatDelay: 2 },
            }
          : {}),
      }}
      exit={{ opacity: 0, x: 100, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{
        type: "spring",
        damping: 25,
        stiffness: 300,
        mass: 0.8,
      }}
      className={cn(
        "relative w-[380px] overflow-hidden rounded-xl border bg-card p-5 shadow-2xl backdrop-blur-sm",
        isCritical
          ? "border-urgency-critical/50 shadow-urgency-critical/10"
          : "border-border/50 shadow-lg",
        isCritical && isReTrigger && "animate-pulse-border",
      )}
      style={{ zIndex: 9999 - index }}
    >
      {/* Accent bar */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1",
          isCritical ? "bg-urgency-critical" : task.urgency === "medium" ? "bg-urgency-medium" : "bg-urgency-low",
        )}
      />

      {/* Header */}
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <motion.div
              animate={{ rotate: isReTrigger ? [0, -10, 10, -10, 0] : 0 }}
              transition={{ duration: 0.5, repeat: isReTrigger ? Infinity : 0, repeatDelay: 2 }}
            >
              <AlertTriangle className="h-5 w-5 text-urgency-critical" />
            </motion.div>
          ) : (
            <Bell className="h-5 w-5 text-primary" />
          )}
          <UrgencyBadge urgency={task.urgency as "low" | "medium" | "critical"} />
        </div>
        <button
          onClick={onDismiss}
          className="rounded-full p-1 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <h3 className="mb-1 text-lg font-semibold leading-tight text-foreground">
        {task.title}
      </h3>
      {task.description && (
        <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
          {task.description}
        </p>
      )}

      {/* Time remaining */}
      <div className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground/70">
        <Clock className="h-3.5 w-3.5" />
        <span>{timeRemaining}</span>
        {isReTrigger && (
          <span className="ml-auto flex items-center gap-1 text-urgency-critical">
            <BellOff className="h-3 w-3" />
            Re-triggered
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onComplete}
          className={cn(
            "flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            isCritical
              ? "bg-urgency-critical text-white hover:bg-urgency-critical/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
        >
          Dismiss
        </motion.button>
        {canSnooze && (
          <div className="flex gap-1">
            {[5, 10, 30].map((mins) => (
              <motion.button
                key={mins}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onSnooze(mins)}
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                  mins === defaultSnooze
                    ? "bg-secondary text-secondary-foreground ring-1 ring-primary/30"
                    : "bg-secondary/50 text-secondary-foreground hover:bg-secondary",
                )}
              >
                {mins}m
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Snooze limit warning for critical */}
      {isCritical && !canSnooze && (
        <p className="mt-2 text-xs text-urgency-critical">
          Maximum snooze limit reached. Task must be dismissed.
        </p>
      )}
    </motion.div>
  );
}

/**
 * Format the time remaining until a due date.
 */
function getTimeRemaining(dueTime: string): string {
  const due = new Date(dueTime);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();

  if (diffMs <= 0) return "Overdue";

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? "s" : ""} overdue`;
  }

  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  if (diffHours < 24) {
    return `${diffHours}h ${remainingMins}m overdue`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays !== 1 ? "s" : ""} overdue`;
}
