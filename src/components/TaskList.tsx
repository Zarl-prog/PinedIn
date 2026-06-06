import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { useReminderStore } from "@/store/reminderStore";
import type { Task } from "@/lib/tauriCommands";
import UrgencyBadge from "./UrgencyBadge";

interface TaskListProps {
  searchQuery: string;
}

/**
 * TaskList - Full task manager view with monochrome styling.
 * Displays incomplete then completed tasks with expandable action buttons.
 */
export default function TaskList({ searchQuery }: TaskListProps) {
  const tasks = useReminderStore((s) => s.tasks);
  const completeTask = useReminderStore((s) => s.completeTask);
  const uncompleteFromStore = useReminderStore((s) => s.uncompleteTask);
  const removeTask = useReminderStore((s) => s.removeTask);
  const setAddTaskOpen = useReminderStore((s) => s.setAddTaskOpen);
  const setEditingTask = useReminderStore((s) => s.setEditingTask);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reportError = (e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
    setTimeout(() => setError(null), 4000);
  };

  // Filter by search
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [tasks, searchQuery]);

  const incompleteTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      {error && (
        <div
          role="alert"
          style={{
            padding: "8px 12px",
            marginBottom: "8px",
            background: "#1a1a1a",
            border: "1px solid #2a2a2a",
            borderRadius: "6px",
            fontSize: "13px",
            color: "#ccc",
          }}
        >
          {error}
        </div>
      )}
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
                expanded={expandedId === task.id}
                onToggle={() =>
                  setExpandedId(expandedId === task.id ? null : (task.id ?? null))
                }
                onComplete={() => {
                  if (task.id) {
                    completeTask(task.id).catch(reportError);
                  }
                  setExpandedId(null);
                }}
                onEdit={() => {
                  setEditingTask(task);
                  setExpandedId(null);
                }}
                onDelete={() => {
                  if (task.id) {
                    removeTask(task.id).catch(reportError);
                  }
                  setExpandedId(null);
                }}
                onSnooze={async () => {
                  if (!task.id) return;
                  try {
                    await invoke("snooze_task", { id: task.id });
                  } catch (e) {
                    reportError(e);
                  }
                  setExpandedId(null);
                }}
                onRemind={async () => {
                  if (!task.id) return;
                  try {
                    await invoke("remind_task", { id: task.id, minutes: 30 });
                  } catch (e) {
                    reportError(e);
                  }
                  setExpandedId(null);
                }}
              />
            ))}

            {/* Completed divider */}
            {completedTasks.length > 0 && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    margin: "16px 0 8px",
                  }}
                >
                  <div style={{ flex: 1, height: "1px", background: "#1a1a1a" }} />
                  <span style={{ fontSize: "12px", color: "#333", flexShrink: 0 }}>
                    Completed ({completedTasks.length})
                  </span>
                  <div style={{ flex: 1, height: "1px", background: "#1a1a1a" }} />
                </div>
                {completedTasks.map((task) => (
                  <TaskCardItem
                    key={task.id}
                    task={task}
                    expanded={expandedId === task.id}
                    onToggle={() =>
                      setExpandedId(expandedId === task.id ? null : (task.id ?? null))
                    }
                onComplete={() => {
                  if (task.id) {
                    uncompleteFromStore(task.id).catch(reportError);
                  }
                  setExpandedId(null);
                }}
                    onEdit={() => {
                      setEditingTask(task);
                      setExpandedId(null);
                    }}
                    onDelete={() => {
                      if (task.id) removeTask(task.id);
                      setExpandedId(null);
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
  );
}

// ─── Task Card Item ──────────────────────────────────────────────────────────

interface TaskCardItemProps {
  task: Task;
  expanded: boolean;
  onToggle: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onSnooze?: () => Promise<void>;
  onRemind?: () => Promise<void>;
  completed?: boolean;
}

function TaskCardItem({
  task,
  expanded,
  onToggle,
  onComplete,
  onEdit,
  onDelete,
  onSnooze,
  onRemind,
  completed = false,
}: TaskCardItemProps) {
  const urgency = task.urgency as "low" | "medium" | "critical";
  const hasDueDate = task.due_time && task.due_time.length > 0;
  const hasRecurrence = !!task.recurrence;
  const tags = task.tags
    ? task.tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  // Compute simple progress from due date
  const progressPercent = useMemo(() => {
    if (!task.due_time) return 0;
    const due = new Date(task.due_time + "T23:59:59").getTime();
    const now = Date.now();
    const created = now - 7 * 24 * 60 * 60 * 1000;
    const total = due - created;
    const elapsed = now - created;
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [task.due_time]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.15 }}
      className={completed ? "v-card completed" : "v-card"}
      onClick={() => {
        if (!completed) onToggle();
      }}
      style={{ marginBottom: "8px", cursor: completed ? "default" : "pointer" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        {/* Checkbox */}
        <button
          className={`checkbox-circle${completed ? " checked" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          style={{ marginTop: "2px" }}
        >
          {completed && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1 }}>
              <span
                className="task-title"
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: completed ? "#444" : "#ededed",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {task.title}
              </span>
              {hasRecurrence && (
                <span style={{ fontSize: "12px", color: "#444", flexShrink: 0 }} title={`Repeats ${task.recurrence}`}>
                  ↻
                </span>
              )}
            </div>
            <UrgencyBadge urgency={urgency} />
          </div>

          {/* Description */}
          {task.description && (
            <p
              style={{
                fontSize: "13px",
                color: "#444",
                marginTop: "4px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {task.description}
            </p>
          )}

          {/* Tags */}
          {tags.length > 0 && !completed && (
            <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    background: "#0d0d0d",
                    border: "1px solid #1e1e1e",
                    borderRadius: "999px",
                    padding: "2px 8px",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Meta row */}
          {hasDueDate && !completed && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                marginTop: "6px",
                fontSize: "12px",
                color: "#333",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{formatTaskDate(task.due_time)}</span>
            </div>
          )}

          {/* Progress bar */}
          {!completed && (
            <div className="progress-track" style={{ marginTop: "8px" }}>
              <div
                className="progress-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Expanded actions */}
      <AnimatePresence>
        {expanded && !completed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.12 }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                display: "flex",
                gap: "6px",
                marginTop: "10px",
                paddingTop: "10px",
                borderTop: "1px solid #1a1a1a",
              }}
            >
              {/* Done */}
              <button
                className="v-action"
                onClick={(e) => { e.stopPropagation(); onComplete(); }}
                style={{ flex: 1, textAlign: "center", padding: "8px 10px" }}
              >
                ✓ Done
              </button>
              {/* Snooze */}
              <button
                className="v-action"
                onClick={(e) => { e.stopPropagation(); onSnooze?.(); }}
                style={{ flex: 1, textAlign: "center", padding: "8px 10px" }}
              >
                💤 Snooze
              </button>
              {/* Remind */}
              <button
                className="v-action"
                onClick={(e) => { e.stopPropagation(); onRemind?.(); }}
                style={{ flex: 1, textAlign: "center", padding: "8px 10px" }}
              >
                🔔 Remind
              </button>
              {/* Delete */}
              <button
                className="v-action"
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm("Delete this task?")) {
                    onDelete();
                  }
                }}
                title="Delete task"
                style={{ flex: 1, textAlign: "center", padding: "8px 10px", color: "#888" }}
              >
                🗑
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#333"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: "12px" }}
      >
        <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-14 0Z" />
        <circle cx="12" cy="9" r="2.5" fill="#333" stroke="none" />
      </svg>
      <span style={{ fontSize: "15px", fontWeight: 600, color: "#555", marginBottom: "4px" }}>
        No tasks yet
      </span>
      <span style={{ fontSize: "13px", color: "#444", textAlign: "center", marginBottom: "16px" }}>
        Create your first task to get started
      </span>
      <button
        onClick={onAdd}
        style={{
          fontSize: "13px",
          fontWeight: 600,
          padding: "9px 20px",
          borderRadius: "8px",
          background: "#fff",
          color: "#000",
          border: "none",
          cursor: "pointer",
          transition: "opacity 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
      >
        + Create Task
      </button>
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

  if (diffTime === 0) return "Today";
  if (diffTime === 86400000) return "Tomorrow";
  if (diffTime === -86400000) return "Yesterday";

  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < -1) return `${Math.abs(diffDays)} days overdue`;
  if (diffDays > 1) return `In ${diffDays} days`;

  return due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
