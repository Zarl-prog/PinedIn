import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useReminderStore } from "@/store/reminderStore";
import { completeTask as completeTaskCmd, uncompleteTask as uncompleteTaskCmd, deleteTask } from "@/lib/tauriCommands";
import type { Task } from "@/lib/tauriCommands";
import UrgencyBadge from "./UrgencyBadge";

interface WorkspaceDetailViewProps {
  workspaceId: number;
  workspaceName: string;
  onBack: () => void;
  onAddTask: () => void;
  onPreSchedule: () => void;
}

function formatCardDate(dateStr: string): string {
  if (!dateStr) return "";
  const due = new Date(dateStr + "T00:00:00");
  if (isNaN(due.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = due.getTime() - today.getTime();
  if (diffTime === 0) return "Today";
  if (diffTime === 86400000) return "Tomorrow";
  if (diffTime === -86400000) return "Yesterday";
  const diffDays = Math.round(diffTime / 86400000);
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays > 1) return `In ${diffDays}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function sortTasks(a: Task, b: Task): number {
  const urgencyOrder = { critical: 0, medium: 1, low: 2 };
  const aOrder = urgencyOrder[a.urgency as keyof typeof urgencyOrder] ?? 3;
  const bOrder = urgencyOrder[b.urgency as keyof typeof urgencyOrder] ?? 3;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
}

export default function WorkspaceDetailView({
  workspaceId,
  workspaceName,
  onBack,
  onAddTask,
  onPreSchedule,
}: WorkspaceDetailViewProps) {
  const workspaceTasks = useReminderStore((s) => s.workspaceTasks[workspaceId] || []);
  const fetchWorkspaceTasks = useReminderStore((s) => s.fetchWorkspaceTasks);
  const [loading, setLoading] = useState(true);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    invoke<number | null>("get_active_workspace_id").then((id) => {
      setIsActive(id === workspaceId);
    });
  }, [workspaceId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await fetchWorkspaceTasks(workspaceId);
    } catch (e) {
      console.error("WorkspaceDetailView refresh failed:", e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, fetchWorkspaceTasks]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;
    const unlistenPromise = listen("tasks-updated", () => {
      if (!cancelled) refresh();
    }).catch((err) => {
      console.error("WorkspaceDetailView listen error:", err);
      return (() => {}) as UnlistenFn;
    });
    return () => {
      cancelled = true;
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
    if (!task.id) return;
    try {
      await completeTaskCmd(task.id);
      await fetchWorkspaceTasks(workspaceId);
    } catch (e) {
      console.error("Failed to complete task:", e);
    }
  }

  async function handleUncomplete(task: Task) {
    if (!task.id) return;
    try {
      await uncompleteTaskCmd(task.id);
      await fetchWorkspaceTasks(workspaceId);
    } catch (e) {
      console.error("Failed to uncomplete task:", e);
    }
  }

  async function handleDelete(task: Task) {
    if (!task.id) return;
    try {
      await deleteTask(task.id);
      await fetchWorkspaceTasks(workspaceId);
    } catch (e) {
      console.error("Failed to delete task:", e);
    }
  }

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
          style={{
            background: "transparent",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            padding: "6px 12px",
            color: "var(--text-muted)",
            fontSize: "12px",
            fontFamily: "'Geist Mono', monospace",
            cursor: "pointer",
            transition: "color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-primary)";
            e.currentTarget.style.borderColor = "var(--border-hover)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-muted)";
            e.currentTarget.style.borderColor = "var(--border)";
          }}
        >
          ← Workspaces
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
          <p style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>
            {incompleteTasks.length} incomplete · {completedTasks.length} completed
          </p>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px", alignItems: "center" }}>
          {isActive ? (
            <button
              onClick={handleDeactivate}
              style={{
                background: "transparent",
                border: "1px solid #444",
                color: "#ffffff",
                borderRadius: "6px",
                padding: "7px 14px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Geist Mono', monospace",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              ● Active — Deactivate
            </button>
          ) : (
            <button
              onClick={handleActivate}
              style={{
                background: "#ffffff",
                color: "#000000",
                border: "none",
                borderRadius: "6px",
                padding: "7px 14px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              ▶ Activate Workspace
            </button>
          )}
          <button
            onClick={onPreSchedule}
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: "11px",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "5px",
              padding: "6px 12px",
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            + Pre-Schedule
          </button>
          <button
            onClick={onAddTask}
            style={{
              background: "var(--text-primary)",
              border: "none",
              borderRadius: "5px",
              padding: "6px 12px",
              color: "var(--text-inverse)",
              fontSize: "11px",
              fontWeight: 600,
              fontFamily: "'Geist Mono', monospace",
              cursor: "pointer",
            }}
          >
            + Add Task
          </button>
        </div>
      </div>

      {/* Task list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Loading tasks...</p>
          </div>
        ) : incompleteTasks.length === 0 && completedTasks.length === 0 ? (
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
            <div style={{ fontSize: "32px", opacity: 0.2, color: "var(--text-primary)" }}>◈</div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>
              No tasks in this workspace yet
            </p>
            <p style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "'Geist Mono', monospace" }}>
              Add a task or pre-schedule one to get started
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {incompleteTasks.length > 0 && (
              <>
                <p style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace", marginBottom: "4px" }}>
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
                <p style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace", marginTop: "16px", marginBottom: "4px" }}>
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

interface TaskRowProps {
  task: Task;
  onComplete?: (task: Task) => void;
  onUncomplete?: (task: Task) => void;
  onDelete: (task: Task) => void;
}

function TaskRow({ task, onComplete, onUncomplete, onDelete }: TaskRowProps) {
  const tagList = task.tags
    ? task.tags.split(",").map((t) => t.trim()).filter(Boolean)
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
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span className="task-title" style={{ fontSize: "14px", fontWeight: 500, color: "var(--text-primary)" }}>
            {task.title}
          </span>
          <UrgencyBadge urgency={task.urgency as "low" | "medium" | "critical"} />
          {task.recurrence && (
            <span title={`Repeats ${task.recurrence}`} style={{ fontSize: "11px", color: "var(--text-dim)" }}>↻</span>
          )}
        </div>
        {task.description && (
          <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                <span key={tag} style={{
                  fontSize: "10px",
                  color: "var(--text-muted)",
                  background: "var(--bg-tag)",
                  border: "1px solid var(--border)",
                  borderRadius: "999px",
                  padding: "1px 6px",
                }}>
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
          ✕
        </button>
      )}
    </div>
  );
}
