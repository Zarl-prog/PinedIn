import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  CheckCircle2,
  Clock,
  MoreVertical,
  Trash2,
  Edit3,
  Inbox,
} from "lucide-react";
import UrgencyBadge from "./UrgencyBadge";
import { useReminderStore } from "@/store/reminderStore";
import type { Task } from "@/lib/tauriCommands";
import { cn } from "@/lib/utils";

/**
 * TaskList - Full task manager view with sorting, filtering, and actions.
 * Sorted by urgency then due time.
 * Includes empty state illustration.
 */
export default function TaskList() {
  const tasks = useReminderStore((s) => s.tasks);
  const completeTask = useReminderStore((s) => s.completeTask);
  const removeTask = useReminderStore((s) => s.removeTask);
  const setAddTaskOpen = useReminderStore((s) => s.setAddTaskOpen);
  const setEditingTask = useReminderStore((s) => s.setEditingTask);

  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Filter and sort
  const incompleteTasks = tasks
    .filter((t) => !t.completed)
    .filter(
      (t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  const completedTasks = tasks
    .filter((t) => t.completed)
    .filter(
      (t) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()),
    );

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {incompleteTasks.length} task{incompleteTasks.length !== 1 ? "s" : ""} remaining
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setAddTaskOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </motion.button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {incompleteTasks.length === 0 && completedTasks.length === 0 ? (
            <EmptyState onAdd={() => setAddTaskOpen(true)} />
          ) : (
            <>
              {/* Incomplete tasks */}
              {incompleteTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOpen={openMenuId === task.id}
                  onToggleMenu={() =>
                    setOpenMenuId(openMenuId === task.id ? null : (task.id ?? null))
                  }
                  onComplete={() => {
                    if (task.id) completeTask(task.id);
                    setOpenMenuId(null);
                  }}
                  onEdit={() => {
                    setEditingTask(task);
                    setOpenMenuId(null);
                  }}
                  onDelete={() => {
                    if (task.id) removeTask(task.id);
                    setOpenMenuId(null);
                  }}
                />
              ))}

              {/* Completed tasks section */}
              {completedTasks.length > 0 && (
                <>
                  <div className="mb-2 mt-6 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border/50" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Completed ({completedTasks.length})
                    </span>
                    <div className="h-px flex-1 bg-border/50" />
                  </div>
                  {completedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      isOpen={openMenuId === task.id}
                      onToggleMenu={() =>
                        setOpenMenuId(openMenuId === task.id ? null : (task.id ?? null))
                      }
                      onComplete={() => {
                        if (task.id) completeTask(task.id);
                        setOpenMenuId(null);
                      }}
                      onEdit={() => {
                        setEditingTask(task);
                        setOpenMenuId(null);
                      }}
                      onDelete={() => {
                        if (task.id) removeTask(task.id);
                        setOpenMenuId(null);
                      }}
                      completed
                    />
                  ))}
                </>
              )}
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isOpen: boolean;
  onToggleMenu: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  completed?: boolean;
}

function TaskCard({
  task,
  isOpen,
  onToggleMenu,
  onComplete,
  onEdit,
  onDelete,
  completed = false,
}: TaskCardProps) {
  const isOverdue = !completed && new Date(task.due_time) < new Date();
  const urgency = task.urgency as "low" | "medium" | "critical";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group relative mb-2 rounded-xl border bg-card p-4 transition-all duration-200",
        completed
          ? "border-border/30 opacity-60"
          : isOverdue && urgency === "critical"
            ? "border-urgency-critical/40 shadow-sm shadow-urgency-critical/5"
            : "border-border/50 hover:border-border hover:shadow-md",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={onComplete}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            completed
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/30 hover:border-primary/50",
          )}
        >
          {completed && <CheckCircle2 className="h-3.5 w-3.5" />}
        </motion.button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h3
                className={cn(
                  "truncate text-sm font-medium",
                  completed
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
                )}
              >
                {task.title}
              </h3>
              {task.description && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">
                  {task.description}
                </p>
              )}
            </div>
            <UrgencyBadge urgency={urgency} className="shrink-0" />
          </div>

          {/* Meta */}
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDueDate(task.due_time)}
              {isOverdue && !completed && (
                <span className="text-urgency-critical">Overdue</span>
              )}
            </span>
            {task.repeat && <span>Repeats</span>}
            {task.snooze_count > 0 && (
              <span>Snoozed {task.snooze_count}x</span>
            )}
          </div>
        </div>

        {/* Menu */}
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onToggleMenu}
            className="rounded-lg p-1.5 text-muted-foreground/40 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </motion.button>

          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.1 }}
                className="absolute right-0 top-full z-50 mt-1 w-36 overflow-hidden rounded-lg border border-border bg-popover shadow-xl"
              >
                <button
                  onClick={onEdit}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-muted"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16"
    >
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-muted/30">
        <Inbox className="h-12 w-12 text-muted-foreground/30" />
      </div>
      <h3 className="mb-1 text-lg font-semibold text-foreground">
        No tasks yet
      </h3>
      <p className="mb-6 text-center text-sm text-muted-foreground">
        Create your first task to get started
        <br />
        with PinedIn reminders.
      </p>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={onAdd}
        className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        Create Task
      </motion.button>
    </motion.div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDueDate(dueTime: string): string {
  const due = new Date(dueTime);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffMins = Math.floor(Math.abs(diffMs) / 60000);
  const isPast = diffMs < 0;

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ${isPast ? "ago" : ""}`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours}h ${diffMins % 60}m ${isPast ? "ago" : ""}`;
  }

  return due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
