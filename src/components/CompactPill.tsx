import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../lib/tauriCommands";
import { Check, CaretLeft, CaretRight } from "@phosphor-icons/react";

const COLLAPSED_W = 140;
const COLLAPSED_H = 36;
const EXPANDED_W = 260;
const EXPANDED_H = 120;

const outerStyle: React.CSSProperties = {
  width: COLLAPSED_W,
  height: COLLAPSED_H,
  background: "transparent",
};

export default function CompactPill() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [timerBorderColor, setTimerBorderColor] = useState<string | null>(null);
  const peekTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getTimerColor(task: Task): string | null {
    if (!task.time_limit_minutes || !task.started_at) return null;
    const totalMs = task.time_limit_minutes * 60 * 1000;
    const elapsed = Date.now() - new Date(task.started_at).getTime();
    const remaining = Math.max(0, totalMs - elapsed);
    const pct = (remaining / totalMs) * 100;
    if (pct > 50) return "#ffffff";
    if (pct > 25) return "#f59e0b";
    return "#ef4444";
  }

  const recalcTimerBorder = () => {
    const color = tasks.reduce<string | null>((acc, t) => {
      const c = getTimerColor(t);
      if (!acc && c) return c;
      return acc;
    }, null);
    setTimerBorderColor(color);
  };

  async function refresh() {
    try {
      const all = await invoke<Task[]>("get_incomplete_tasks");
      setTasks(all);
    } catch (e) {
      console.error("[CompactPill] Failed to fetch tasks:", e);
    }
  }

  useEffect(() => {
    refresh();
    const unlisten = listen("tasks-updated", refresh);
    return () => {
      unlisten.then(f => f());
      if (peekTimer.current) clearInterval(peekTimer.current);
      if (clickTimer.current) clearTimeout(clickTimer.current);
    };
  }, []);

  useEffect(() => {
    invoke("reassert_window_properties");
    const timer = setTimeout(() => invoke("reassert_window_properties"), 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const hasTimed = tasks.some(t => t.time_limit_minutes && t.started_at);
    if (!hasTimed) {
      setTimerBorderColor(null);
      return;
    }
    recalcTimerBorder();
    const id = setInterval(recalcTimerBorder, 1000);
    return () => clearInterval(id);
  }, [tasks]);

  function handleClick() {
    if (!peekTimer.current) return;
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clearInterval(peekTimer.current!);
      peekTimer.current = null;
      getCurrentWindow().setSize(new LogicalSize(COLLAPSED_W, COLLAPSED_H));
      setExpanded(false);
      clickTimer.current = null;
    }, 280);
  }

  function handleDoubleClick() {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (tasks.length === 0) return;
    if (peekTimer.current) {
      clearInterval(peekTimer.current);
      peekTimer.current = null;
      getCurrentWindow().setSize(new LogicalSize(COLLAPSED_W, COLLAPSED_H));
      setExpanded(false);
      return;
    }
    getCurrentWindow().setSize(new LogicalSize(EXPANDED_W, EXPANDED_H));
    setExpanded(true);
    setCurrentIndex(0);
    peekTimer.current = setInterval(() => {
      if (peekTimer.current) clearInterval(peekTimer.current);
      peekTimer.current = null;
      getCurrentWindow().setSize(new LogicalSize(COLLAPSED_W, COLLAPSED_H));
      setExpanded(false);
    }, 4000);
  }

  async function handleDone() {
    if (tasks.length === 0) return;
    const taskToComplete = tasks[currentIndex];
    if (!taskToComplete) return;
    const nextIndex = currentIndex >= tasks.length - 1 ? 0 : currentIndex;
    try {
      await invoke("complete_task", { id: taskToComplete.id });
      await refresh();
      setCurrentIndex(nextIndex);
    } catch (e) {
      console.error("[CompactPill] Failed to complete task:", e);
      refresh().catch(() => {});
    }
  }

  function handleNext() {
    setCurrentIndex(i => (i + 1) % tasks.length);
  }

  function handlePrev() {
    setCurrentIndex(i => (i - 1 + tasks.length) % tasks.length);
  }

  function handleMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    getCurrentWindow().startDragging();
  }

  const currentTask = tasks[currentIndex];

  const dotColor = tasks.some(t => t.urgency === "critical")
    ? "#ef4444"
    : tasks.some(t => t.urgency === "medium")
      ? "#f59e0b"
      : "#22c55e";

  const isExpanded = expanded && tasks.length > 0;

  if (isExpanded) {
    return (
      <div onClick={handleClick} onDoubleClick={handleDoubleClick} style={{ ...outerStyle, width: EXPANDED_W, height: EXPANDED_H }}>
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: EXPANDED_W,
            height: EXPANDED_H,
            background: "var(--pill-bg, #060608)",
            border: `1.5px solid ${timerBorderColor || "var(--pill-border, #1a1a1a)"}`,
            borderRadius: "16px",
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            overflow: "hidden",
            cursor: "grab",
            userSelect: "none",
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "var(--pill-text, #ffffff)", fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>
          <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--pill-text, #ffffff)", fontFamily: "'Geist Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {currentTask?.title}
          </div>
          <div style={{ fontSize: "10px", color: "var(--pill-text-muted, #777)", fontFamily: "'Geist Mono', monospace" }}>
            {currentIndex + 1} / {tasks.length}
          </div>
          <div style={{ display: "flex", gap: "5px" }}>
            <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid var(--pill-border, #1a1a1a)", background: "transparent", color: "var(--pill-text-muted, #777)", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CaretLeft size={14} weight="light" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleDone(); }} style={{ flex: 1, height: "24px", borderRadius: "5px", border: "1px solid var(--btn-done-border, rgba(34,197,94,0.3))", background: "var(--btn-done-bg, rgba(34,197,94,0.1))", color: "var(--btn-done-text, #22c55e)", fontSize: "10px", fontWeight: 600, cursor: "pointer", fontFamily: "'Geist Mono', monospace" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center" }}><Check size={14} weight="light" /> Done</span>
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleNext(); }} style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid var(--pill-border, #1a1a1a)", background: "transparent", color: "var(--pill-text-muted, #777)", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CaretRight size={14} weight="light" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div onClick={handleClick} onDoubleClick={handleDoubleClick} style={outerStyle}>
      <div
        onMouseDown={handleMouseDown}
        style={{
          width: COLLAPSED_W,
          height: COLLAPSED_H,
          background: "var(--pill-bg, #060608)",
          border: `1.5px solid ${timerBorderColor || "var(--pill-border, #1a1a1a)"}`,
          borderRadius: "999px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          cursor: "grab",
          userSelect: "none",
          overflow: "hidden",
          flexShrink: 0,
          transition: "border-color 0.5s ease",
          boxSizing: "border-box",
        }}
      >
        {tasks.length === 0 ? (
          <span style={{ fontSize: "11px", color: "var(--pill-text-muted, #444)", fontFamily: "'Geist Mono', monospace", display: "flex", alignItems: "center", gap: "4px" }}><Check size={14} weight="light" /> All clear</span>
        ) : (
          <>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: "var(--pill-text, #ffffff)", fontFamily: "'Geist Mono', monospace", fontWeight: 600, whiteSpace: "nowrap" }}>
              {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
