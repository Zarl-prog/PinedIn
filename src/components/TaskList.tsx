import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useReminderStore } from "@/store/reminderStore";
import {
  type Task,
  closeTaskCard,
} from "@/lib/tauriCommands";
import UrgencyBadge from "./UrgencyBadge";
import Skeleton from "./ui/Skeleton";

interface TaskListProps {
  searchQuery: string;
}

/**
 * TaskList - Full task manager view with monochrome styling.
 * Displays incomplete then completed tasks with expandable action buttons.
 */
export default function TaskList({ searchQuery }: TaskListProps) {
  const tasks = useReminderStore((s) => s.tasks);
  const workspaceTasks = useReminderStore((s) => s.workspaceTasks);
  const fetchTasks = useReminderStore((s) => s.fetchTasks);
  const fetchWorkspaceTasks = useReminderStore((s) => s.fetchWorkspaceTasks);
  const scheduledTasks = useReminderStore((s) => s.scheduledTasks);
  const completeTask = useReminderStore((s) => s.completeTask);
  const uncompleteFromStore = useReminderStore((s) => s.uncompleteTask);
  const removeTask = useReminderStore((s) => s.removeTask);
  const removeScheduledTask = useReminderStore((s) => s.removeScheduledTask);
  const setAddTaskOpen = useReminderStore((s) => s.setAddTaskOpen);
  const setEditingTask = useReminderStore((s) => s.setEditingTask);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<number | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reportError = (e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
    setTimeout(() => setError(null), 4000);
  };

  // Close the three-dot menu on any outside click
  useEffect(() => {
    if (menuOpenId === null) return;
    const handleClick = () => setMenuOpenId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [menuOpenId]);

  // Active workspace filtering
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<number | null>(null);

  useEffect(() => {
    invoke<number | null>("get_active_workspace_id").then(setActiveWorkspaceId);

    const unlisten1 = listen("workspace_activated", () => {
      invoke<number | null>("get_active_workspace_id").then(setActiveWorkspaceId);
    });
    const unlisten2 = listen("workspace_deactivated", () => {
      setActiveWorkspaceId(null);
    });
    return () => {
      unlisten1.then((f) => f());
      unlisten2.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (activeWorkspaceId !== null) {
      fetchWorkspaceTasks(activeWorkspaceId);
    }
  }, [activeWorkspaceId, fetchWorkspaceTasks]);

  useEffect(() => {
    fetchTasks().finally(() => setLoading(false));
  }, [fetchTasks]);

  const displayTasks = useMemo(() => {
    if (activeWorkspaceId !== null) {
      return workspaceTasks[activeWorkspaceId] || [];
    }
    return tasks;
  }, [tasks, workspaceTasks, activeWorkspaceId]);

  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return displayTasks;
    const q = searchQuery.toLowerCase();
    return displayTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [displayTasks, searchQuery]);

  const filteredScheduledTasks = useMemo(() => {
    if (activeWorkspaceId !== null) return [];
    if (!searchQuery.trim()) return scheduledTasks;
    const q = searchQuery.toLowerCase();
    return scheduledTasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q),
    );
  }, [scheduledTasks, searchQuery, activeWorkspaceId]);

  const incompleteTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);

  const handleDelete = async (task: Task) => {
    if (!task.id) return;
    try {
      await removeTask(task.id);
      // Explicitly close the floating card window in case the task
      // had one open. removeTask → deleteTask already does this in
      // the backend, but the explicit invoke keeps the call site
      // self-documenting and survives any future backend change.
      await closeTaskCard(task.id).catch(() => {});
    } catch (e) {
      reportError(e);
    }
  };

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      {error && (
        <div
          role="alert"
          style={{
            padding: "8px 12px",
            marginBottom: "8px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-hover)",
            borderRadius: "6px",
            fontSize: "13px",
            color: "var(--text-secondary)",
          }}
        >
          {error}
        </div>
      )}
      <AnimatePresence mode="popLayout">
        {loading ? (
          <SkeletonRows />
        ) : incompleteTasks.length === 0 &&
        completedTasks.length === 0 &&
        filteredScheduledTasks.length === 0 ? (
          <EmptyState onAdd={() => setAddTaskOpen(true)} />
        ) : (
          <>
            {incompleteTasks.map((task) => (
              <TaskCardItem
                key={task.id}
                task={task}
                expanded={expandedId === task.id}
                menuOpen={menuOpenId === task.id}
                onToggle={() =>
                  setExpandedId(expandedId === task.id ? null : (task.id ?? null))
                }
                onToggleMenu={() =>
                  setMenuOpenId(menuOpenId === task.id ? null : (task.id ?? null))
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
                  setMenuOpenId(null);
                }}
                onDelete={() => {
                  handleDelete(task);
                  setExpandedId(null);
                  setMenuOpenId(null);
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

            {completedTasks.length > 0 && (
              <>
                <div
                  onClick={() => setCompletedExpanded((p) => !p)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    margin: "16px 0 8px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ flex: 1, height: "1px", background: "var(--divider)" }} />
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span style={{
                      display: "inline-block",
                      transition: "transform 0.15s ease",
                      transform: completedExpanded ? "rotate(90deg)" : "rotate(0deg)",
                    }}>
                      ›
                    </span>
                    Completed ({completedTasks.length})
                  </span>
                  {completedExpanded && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        Promise.all(
                          completedTasks.map((t) =>
                            t.id ? removeTask(t.id).catch(reportError) : Promise.resolve()
                          )
                        ).then(() => setCompletedExpanded(false));
                      }}
                      title="Delete all completed tasks"
                      style={{
                        fontSize: "11px",
                        color: "var(--text-muted)",
                        background: "transparent",
                        border: "1px solid var(--border-light)",
                        borderRadius: "4px",
                        padding: "2px 6px",
                        cursor: "pointer",
                        fontFamily: "'Geist Mono', monospace",
                        transition: "all 0.15s ease",
                        flexShrink: 0,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--text-danger)";
                        e.currentTarget.style.borderColor = "var(--text-danger)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--text-muted)";
                        e.currentTarget.style.borderColor = "var(--border-light)";
                      }}
                    >
                      Clear All
                    </button>
                  )}
                  <div style={{ flex: 1, height: "1px", background: "var(--divider)" }} />
                </div>
                <AnimatePresence>
                  {completedExpanded && completedTasks.map((task) => (
                    <TaskCardItem
                      key={task.id}
                      task={task}
                      expanded={expandedId === task.id}
                      menuOpen={menuOpenId === task.id}
                      onToggle={() =>
                        setExpandedId(expandedId === task.id ? null : (task.id ?? null))
                      }
                      onToggleMenu={() =>
                        setMenuOpenId(menuOpenId === task.id ? null : (task.id ?? null))
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
                        setMenuOpenId(null);
                      }}
                      onDelete={() => {
                        handleDelete(task);
                        setExpandedId(null);
                        setMenuOpenId(null);
                      }}
                      completed
                    />
                  ))}
                </AnimatePresence>
              </>
            )}

            {filteredScheduledTasks.length > 0 && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    margin: "16px 0 8px",
                  }}
                >
                  <div style={{ flex: 1, height: "1px", background: "var(--divider)" }} />
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", flexShrink: 0 }}>
                    Scheduled ({filteredScheduledTasks.length})
                  </span>
                  <div style={{ flex: 1, height: "1px", background: "var(--divider)" }} />
                </div>
                {filteredScheduledTasks.map((task) => (
                  <ScheduledRow
                    key={task.id}
                    task={task}
                    onCancel={() => {
                      if (task.id) {
                        removeScheduledTask(task.id).catch(reportError);
                      }
                    }}
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
  menuOpen: boolean;
  onToggle: () => void;
  onToggleMenu: () => void;
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
  menuOpen,
  onToggle,
  onToggleMenu,
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
  const menuRef = useRef<HTMLDivElement>(null);

  const progressPercent = useMemo(() => {
    if (!task.due_time) return 0;
    const due = new Date(task.due_time + "T23:59:59").getTime();
    const now = Date.now();
    // Use the task's actual creation time so the bar shows true elapsed progress
    const created = new Date(task.created_at).getTime();
    const total = due - created;
    const elapsed = now - created;
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [task.due_time, task.created_at]);

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
      style={{ marginBottom: "8px", cursor: completed ? "default" : "pointer", position: "relative" }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <button
          className={`checkbox-circle${completed ? " checked" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          style={{ marginTop: "2px" }}
        >
          {completed && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, flex: 1 }}>
              <span
                className="task-title"
                style={{
                  fontSize: "14px",
                  fontWeight: 500,
                  color: completed ? "var(--text-muted)" : "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {task.title}
              </span>
              {hasRecurrence && (
                <span style={{ fontSize: "12px", color: "var(--text-muted)", flexShrink: 0 }} title={`Repeats ${task.recurrence}`}>
                  ↻
                </span>
              )}
            </div>
              <UrgencyBadge urgency={urgency} />
            {/* Three-dot context menu trigger */}
            <div ref={menuRef} style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMenu();
                }}
                title="More actions"
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-light)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  lineHeight: 1,
                  padding: 0,
                  letterSpacing: "1px",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-badge)";
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.borderColor = "var(--text-muted)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.borderColor = "var(--border-light)";
                }}
              >
                ⋯
              </button>

              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.96 }}
                    transition={{ duration: 0.1 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      right: 0,
                      zIndex: 50,
                      minWidth: "120px",
                      background: "var(--bg-menu)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      padding: "4px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      boxShadow: "var(--shadow-menu)",
                    }}
                  >
                    <button
                      onClick={onEdit}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "7px 10px",
                        background: "transparent",
                        border: "none",
                        borderRadius: "6px",
                        color: "var(--text-primary)",
                        fontSize: "13px",
                        fontFamily: "'Geist Mono', monospace",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-menu-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ color: "var(--text-secondary)", fontSize: "12px", width: "12px" }}>✎</span>
                      Edit
                    </button>
                    <button
                      onClick={onDelete}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "7px 10px",
                        background: "transparent",
                        border: "none",
                        borderRadius: "6px",
                        color: "var(--text-danger)",
                        fontSize: "13px",
                        fontFamily: "'Geist Mono', monospace",
                        cursor: "pointer",
                        textAlign: "left",
                        width: "100%",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-delete-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span style={{ color: "var(--text-danger)", fontSize: "12px", width: "12px" }}>🗑</span>
                      Delete
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {task.description && (
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
                marginTop: "4px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {task.description}
            </p>
          )}

          {tags.length > 0 && !completed && (
            <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    background: "var(--bg-tag)",
                    border: "1px solid var(--border)",
                    borderRadius: "999px",
                    padding: "2px 8px",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {hasDueDate && !completed && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                marginTop: "6px",
                fontSize: "12px",
                color: "var(--text-muted)",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{formatTaskDate(task.due_time)}</span>
            </div>
          )}

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
                borderTop: "1px solid var(--divider)",
              }}
            >
              <button
                className="v-action"
                onClick={(e) => { e.stopPropagation(); onComplete(); }}
                style={{ flex: 1, textAlign: "center", padding: "8px 10px" }}
              >
                ✓ Done
              </button>
              <button
                className="v-action"
                onClick={(e) => { e.stopPropagation(); onSnooze?.(); }}
                style={{ flex: 1, textAlign: "center", padding: "8px 10px" }}
              >
                💤 Snooze
              </button>
              <button
                className="v-action"
                onClick={(e) => { e.stopPropagation(); onRemind?.(); }}
                style={{ flex: 1, textAlign: "center", padding: "8px 10px" }}
              >
                🔔 Remind
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Scheduled Row ───────────────────────────────────────────────────────────

function ScheduledRow({ task, onCancel }: { task: Task; onCancel: () => void }) {
  const urgency = task.urgency as "low" | "medium" | "critical";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 12px",
        background: "var(--bg-scheduled)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        marginBottom: "6px",
      }}
    >
      <span style={{ fontSize: "12px", color: "var(--text-muted)", flexShrink: 0 }}>⏰</span>
      <span
        style={{
          fontSize: "13px",
          color: "var(--text-secondary)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flex: 1,
          minWidth: 0,
        }}
      >
        {task.title}
      </span>
      <UrgencyBadge urgency={urgency} />
      <span
        style={{
          fontSize: "12px",
          color: "var(--text-muted)",
          flexShrink: 0,
        }}
      >
        {formatScheduledTime(task.scheduled_at)}
      </span>
      <button
        onClick={onCancel}
        title="Cancel scheduled task"
        style={{
          width: "22px",
          height: "22px",
          borderRadius: "6px",
          border: "1px solid var(--border-light)",
          background: "transparent",
          color: "var(--text-secondary)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          flexShrink: 0,
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--bg-badge)";
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.borderColor = "var(--text-muted)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-secondary)";
          e.currentTarget.style.borderColor = "var(--border-light)";
        }}
      >
        ✕
      </button>
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
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ marginBottom: "12px" }}
      >
        <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-14 0Z"/>
        <circle cx="12" cy="9" r="2.5" fill="currentColor" stroke="none"/>
      </svg>
      <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>
        No tasks yet
      </span>
      <span style={{ fontSize: "13px", color: "var(--text-muted)", textAlign: "center", marginBottom: "16px" }}>
        Create your first task to get started
      </span>
      <button
        onClick={onAdd}
        style={{
          fontSize: "13px",
          fontWeight: 600,
          padding: "9px 20px",
          borderRadius: "8px",
          background: "var(--text-primary)",
          color: "var(--text-inverse)",
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

// ─── Skeleton Rows ─────────────────────────────────────────────────────────────

function SkeletonRows() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            padding: "14px 12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Skeleton width={16} height={16} borderRadius="50%" />
            <Skeleton width={`${60 + i * 10}%`} height={14} />
            <Skeleton width={44} height={18} borderRadius={999} style={{ marginLeft: "auto" }} />
          </div>
          <Skeleton width={`${40 + i * 8}%`} height={10} style={{ marginLeft: "26px" }} />
        </div>
      ))}
    </div>
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

function formatScheduledTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const dateStr = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const timeStr = d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${dateStr} at ${timeStr}`;
}
