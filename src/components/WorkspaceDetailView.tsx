import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useReminderStore } from "@/store/reminderStore";
import {
  completeTask as completeTaskCmd,
  uncompleteTask as uncompleteTaskCmd,
  deleteTask,
} from "@/lib/tauriCommands";
import type { Task } from "@/lib/tauriCommands";
import {
  ArrowLeft,
  Circle,
  Play,
  Diamond,
  ArrowsClockwise,
  Alarm,
  X,
  PencilSimpleLine,
} from "@phosphor-icons/react";
import { formatCardDate, sortTasks } from "@/lib/utils";

interface WorkspaceDetailViewProps {
  workspaceId: number;
  workspaceName: string;
  onBack: () => void;
  onAddTask: () => void;
  onPreSchedule: () => void;
}

export default function WorkspaceDetailView({
  workspaceId,
  workspaceName,
  onBack,
  onAddTask,
  onPreSchedule,
}: WorkspaceDetailViewProps) {
  const workspaceTasks = useReminderStore((s) => s.workspaceTasks[workspaceId] || []);
  const scheduledTasks = useReminderStore((s) => s.scheduledTasks);

  // Pull actions via getState() so they are always stable references
  // and never trigger useEffect/useCallback dependency re-runs.
  const fetchWorkspaceTasks = useReminderStore.getState().fetchWorkspaceTasks;
  const fetchScheduledTasks = useReminderStore.getState().fetchScheduledTasks;
  const removeScheduledTask = useReminderStore.getState().removeScheduledTask;

  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);
  const isFetchingRef = useRef(false);

  useEffect(() => {
    invoke<number | null>("get_active_workspace_id")
      .then((id) => {
        setIsActive(id === workspaceId);
      })
      .catch((e) => {
        console.error("Failed to get active workspace id:", e);
      });
  }, [workspaceId]);

  const refresh = useCallback(async () => {
    if (isFetchingRef.current) return; // prevent re-entrant calls
    isFetchingRef.current = true;
    setLoading(true);
    try {
      await fetchWorkspaceTasks(workspaceId);
    } catch (e) {
      console.error("WorkspaceDetailView refresh failed:", e);
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [workspaceId]); // fetchWorkspaceTasks is stable via getState()

  useEffect(() => {
    refresh();
    fetchScheduledTasks();
  }, [refresh]); // fetchScheduledTasks is stable via getState()

  useEffect(() => {
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const unlistenPromise = listen("tasks-updated", () => {
      if (cancelled) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!cancelled) refresh();
      }, 100);
    }).catch((err) => {
      console.error("WorkspaceDetailView listen error:", err);
      return (() => {}) as UnlistenFn;
    });

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      unlistenPromise.then((fn) => fn());
    };
  }, [refresh]);

  async function handleActivate() {
    try {
      await invoke("activate_workspace", { workspaceId });
      setIsActive(true);
    } catch (e) {
      console.error("Failed to activate workspace:", e);
    }
  }

  async function handleDeactivate() {
    try {
      await invoke("deactivate_workspace");
      setIsActive(false);
    } catch (e) {
      console.error("Failed to deactivate workspace:", e);
    }
  }

  async function handleComplete(task: Task) {
    if (task.id == null) return;
    try {
      await completeTaskCmd(task.id);
      await fetchWorkspaceTasks(workspaceId);
    } catch (e) {
      console.error("Failed to complete task:", e);
    }
  }

  async function handleUncomplete(task: Task) {
    if (task.id == null) return;
    try {
      await uncompleteTaskCmd(task.id);
      await fetchWorkspaceTasks(workspaceId);
    } catch (e) {
      console.error("Failed to uncomplete task:", e);
    }
  }

  async function handleDelete(task: Task) {
    if (task.id == null) return;
    try {
      await deleteTask(task.id);
      await fetchWorkspaceTasks(workspaceId);
    } catch (e) {
      console.error("Failed to delete task:", e);
    }
  }

  async function handleCancelScheduled(taskId: number) {
    try {
      await removeScheduledTask(taskId);
    } catch (e) {
      console.error("Failed to cancel scheduled task:", e);
    }
  }

  const workspaceScheduledTasks = useMemo(
    () => scheduledTasks.filter((t) => t.workspace_id === workspaceId),
    [scheduledTasks, workspaceId],
  );
  const incompleteTasks = workspaceTasks.filter((t) => !t.completed).sort(sortTasks);
  const completedTasks = workspaceTasks.filter((t) => t.completed).sort(sortTasks);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.15 }}
      style={{
        padding: "24px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
        <button
          onClick={onBack}
          className="feature-btn"
          style={{ fontSize: "12px", padding: "6px 12px" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <ArrowLeft size={14} weight="light" /> Workspaces
          </span>
        </button>
        <div>
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFamily: "'Geist Mono', monospace",
              letterSpacing: "-0.5px",
            }}
          >
            {workspaceName}
          </h2>
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-muted)",
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            {incompleteTasks.length} incomplete · {completedTasks.length} completed
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
          {isActive ? (
            <button
              onClick={handleDeactivate}
              className="feature-btn active"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Circle size={12} weight="fill" /> Active — Deactivate
              </span>
            </button>
          ) : (
            <button
              onClick={handleActivate}
              className="feature-btn primary"
              style={{ padding: "7px 14px" }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Play size={14} weight="light" /> Activate Workspace
              </span>
            </button>
          )}
          <button onClick={onPreSchedule} className="feature-btn" style={{ padding: "6px 12px" }}>
            + Pre-Schedule
          </button>
          <button
            onClick={onAddTask}
            className="feature-btn primary"
            style={{ padding: "6px 12px", fontSize: "11px" }}
          >
            + Add Task
          </button>
          <button
            onClick={() => useReminderStore.getState().setCustomizeOpen(true)}
            className="feature-btn"
            style={{
              padding: "6px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Customize your tasks"
          >
            <PencilSimpleLine size={16} weight="light" />
          </button>
        </div>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {loading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
            }}
          >
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading tasks...</p>
          </div>
        ) : workspaceScheduledTasks.length === 0 &&
          incompleteTasks.length === 0 &&
          completedTasks.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              gap: "12px",
            }}
          >
            <Diamond
              size={32}
              weight="light"
              style={{ opacity: 0.2, color: "var(--text-primary)" }}
            />
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              No tasks in this workspace yet
            </p>
            <p
              style={{
                fontSize: "11px",
                color: "var(--text-dim)",
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              Add a task or pre-schedule one to get started
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {workspaceScheduledTasks.length > 0 && (
              <>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    fontFamily: "'Geist Mono', monospace",
                    marginBottom: "4px",
                    marginTop: "8px",
                  }}
                >
                  Scheduled — {workspaceScheduledTasks.length}
                </p>
                {workspaceScheduledTasks.map((task) => (
                  <ScheduledRow
                    key={task.id}
                    task={task}
                    onCancel={() => {
                      if (task.id != null) handleCancelScheduled(task.id);
                    }}
                  />
                ))}
              </>
            )}

            {incompleteTasks.length > 0 && (
              <>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    fontFamily: "'Geist Mono', monospace",
                    marginBottom: "4px",
                  }}
                >
                  Active — {incompleteTasks.length}
                </p>
                {incompleteTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                  />
                ))}
              </>
            )}

            {completedTasks.length > 0 && (
              <>
                <p
                  style={{
                    fontSize: "11px",
                    color: "var(--text-muted)",
                    fontFamily: "'Geist Mono', monospace",
                    marginTop: "16px",
                    marginBottom: "4px",
                  }}
                >
                  Completed — {completedTasks.length}
                </p>
                {completedTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onUncomplete={handleUncomplete}
                    onDelete={handleDelete}
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
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

interface ScheduledRowProps {
  task: Task;
  onCancel: () => void;
}

function ScheduledRow({ task, onCancel }: ScheduledRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 12px",
        background: "var(--bg-scheduled, var(--bg-card))",
        border: "1px solid var(--border)",
        borderRadius: "8px",
      }}
    >
      <Alarm size={14} weight="light" color="var(--text-muted)" />
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
          e.currentTarget.style.background = "var(--bg-badge, var(--bg-card))";
          e.currentTarget.style.color = "var(--text-primary)";
          e.currentTarget.style.borderColor = "var(--text-muted)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--text-secondary)";
          e.currentTarget.style.borderColor = "var(--border-light)";
        }}
      >
        <X size={14} weight="light" />
      </button>
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  onComplete?: (task: Task) => void;
  onUncomplete?: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function TaskRow({ task, onComplete, onUncomplete, onDelete }: TaskRowProps) {
  const tagList = task.tags
    ? task.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  return (
    <div
      className={`v-card${task.completed ? " completed" : ""}`}
      style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}
    >
      <button
        onClick={() => {
          if (task.completed && onUncomplete) onUncomplete(task);
          else if (!task.completed && onComplete) onComplete(task);
        }}
        className={`checkbox-circle${task.completed ? " checked" : ""}`}
        style={{ marginTop: "1px", flexShrink: 0 }}
        title={task.completed ? "Mark incomplete" : "Mark complete"}
      >
        {task.completed && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-inverse)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span
            className="task-title"
            style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}
          >
            {task.title}
          </span>
          {task.recurrence && (
            <span
              title={`Repeats ${task.recurrence}`}
              style={{
                fontSize: "11px",
                color: "var(--text-dim)",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <ArrowsClockwise size={11} weight="light" />
            </span>
          )}
        </div>
        {task.description && (
          <p
            style={{
              fontSize: "12px",
              color: "var(--text-secondary)",
              marginTop: "2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {task.description}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
          {task.due_time && (
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {formatCardDate(task.due_time)}
            </span>
          )}
          {tagList.length > 0 && (
            <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
              {tagList.map((tag) => (
                <span
                  key={tag}
                  style={{
                    fontSize: "10px",
                    color: "var(--text-muted)",
                    background: "var(--bg-tag)",
                    border: "1px solid var(--border)",
                    borderRadius: "999px",
                    padding: "1px 6px",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {task.completed && (
        <button
          onClick={() => onDelete(task)}
          title="Delete task"
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: "14px",
            padding: "2px 6px",
            borderRadius: "4px",
            fontFamily: "'Geist Mono', monospace",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
        >
          <X size={14} weight="light" />
        </button>
      )}
    </div>
  );
}
