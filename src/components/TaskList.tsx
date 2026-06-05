import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  CheckCircle2,
  Calendar,
  MoreVertical,
  Trash2,
  Edit3,
  Inbox,
  X,
} from "lucide-react";
import UrgencyBadge from "./UrgencyBadge";
import { useReminderStore } from "@/store/reminderStore";
import type { Task } from "@/lib/tauriCommands";
import { cn } from "@/lib/utils";

/**
 * TaskList - Full task manager view with sorting, filtering, tags, and actions.
 * Sorted by urgency then creation date.
 */
export default function TaskList() {
  const tasks = useReminderStore((s) => s.tasks);
  const completeTask = useReminderStore((s) => s.completeTask);
  const removeTask = useReminderStore((s) => s.removeTask);
  const setAddTaskOpen = useReminderStore((s) => s.setAddTaskOpen);
  const setEditingTask = useReminderStore((s) => s.setEditingTask);
  const activeTags = useReminderStore((s) => s.activeTags);
  const setActiveTags = useReminderStore((s) => s.setActiveTags);

  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Collect all unique tags across tasks
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    tasks.forEach((t) => {
      if (t.tags) {
        t.tags.split(",").forEach((tag) => {
          const trimmed = tag.trim();
          if (trimmed) tagSet.add(trimmed);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [tasks]);

  const toggleTag = (tag: string) => {
    setActiveTags(
      activeTags.includes(tag)
        ? activeTags.filter((t) => t !== tag)
        : [...activeTags, tag],
    );
  };

  const clearTags = () => setActiveTags([]);

  // Filter and sort
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search filter
      const matchesSearch =
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());

      // Tag filter (AND logic)
      const matchesTags =
        activeTags.length === 0 ||
        (t.tags &&
          activeTags.every((tag) =>
            t.tags!.split(",").map((s) => s.trim()).includes(tag),
          ));

      return matchesSearch && matchesTags;
    });
  }, [tasks, searchQuery, activeTags]);

  const incompleteTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <div className="mb-4 flex shrink-0 items-center justify-between">
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
      <div className="relative mb-3 shrink-0">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5">
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-all",
                activeTags.includes(tag)
                  ? "bg-primary/20 text-primary ring-1 ring-primary/40"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {tag}
            </button>
          ))}
          {activeTags.length > 0 && (
            <button
              onClick={clearTags}
              className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Task list */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="popLayout">
          {incompleteTasks.length === 0 && completedTasks.length === 0 ? (
            <EmptyState onAdd={() => setAddTaskOpen(true)} />
          ) : (
            <>
              {/* Incomplete tasks */}
              {incompleteTasks.map((task) => (
                <TaskCardItem
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
                    <TaskCardItem
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

interface TaskCardItemProps {
  task: Task;
  isOpen: boolean;
  onToggleMenu: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  completed?: boolean;
}

function TaskCardItem({
  task,
  isOpen,
  onToggleMenu,
  onComplete,
  onEdit,
  onDelete,
  completed = false,
}: TaskCardItemProps) {
  const urgency = task.urgency as "low" | "medium" | "critical";
  const hasDueDate = task.due_time && task.due_time.length > 0;
  const hasRecurrence = !!task.recurrence;
  const tags = task.tags
    ? task.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

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
                  "flex items-center gap-1.5 truncate text-sm font-medium",
                  completed
                    ? "text-muted-foreground line-through"
                    : "text-foreground",
                )}
              >
                {task.title}
                {hasRecurrence && (
                  <span
                    className="inline-flex shrink-0 items-center text-xs text-primary/60"
                    title={`Repeats ${task.recurrence}`}
                  >
                    ↻
                  </span>
                )}
              </h3>
              {task.description && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/70">
                  {task.description}
                </p>
              )}
              {/* Tags */}
              {tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary/70"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <UrgencyBadge urgency={urgency} className="shrink-0" />
          </div>

          {/* Meta */}
          {hasDueDate && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <Calendar className="h-3 w-3" />
              <span>{formatTaskDate(task.due_time)}</span>
            </div>
          )}
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
        with PinedIn.
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

function formatTaskDate(dateStr: string): string {
  if (!dateStr) return "";
  const due = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffTime === 0) return "Today";
  if (diffTime === 86400000) return "Tomorrow";
  if (diffTime === -86400000) return "Yesterday";

  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays > 1) return `In ${diffDays} days`;

  return due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
