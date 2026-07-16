import { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../lib/tauriCommands";
import { Check, CaretLeft, CaretRight } from "@phosphor-icons/react";

const COLLAPSED_W = 100;
const COLLAPSED_H = 36;
const EXPANDED_W = 260;
const EXPANDED_H = 120;
const AUTO_CLOSE_MS = 3000;

export default function CompactPill() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [timerBorderColor, setTimerBorderColor] = useState<string | null>(null);
  const didDrag = useRef(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringRef = useRef(false);

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
    const p = listen("tasks-updated", refresh);
    return () => { p.then(f => f(), () => {}); };
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

  useEffect(() => {
    const win = getCurrentWindow();
    if (expanded) {
      win.setSize(new LogicalSize(EXPANDED_W, EXPANDED_H));
    } else {
      win.setSize(new LogicalSize(COLLAPSED_W, COLLAPSED_H));
    }
  }, [expanded]);

  useEffect(() => {
    if (allClearTimerRef.current) {
      clearTimeout(allClearTimerRef.current);
      allClearTimerRef.current = null;
    }
    if (tasks.length > 0) return;
    allClearTimerRef.current = setTimeout(() => {
      getCurrentWindow().close();
    }, 5000);
    return () => {
      if (allClearTimerRef.current) {
        clearTimeout(allClearTimerRef.current);
        allClearTimerRef.current = null;
      }
    };
  }, [tasks.length]);

  useEffect(() => {
    if (!expanded) {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
      return;
    }
    if (isHoveringRef.current) {
      return;
    }
    autoCloseRef.current = setTimeout(() => {
      setExpanded(false);
      autoCloseRef.current = null;
    }, AUTO_CLOSE_MS);
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [expanded]);

  function handleMouseEnter() {
    if (!expanded) return;
    isHoveringRef.current = true;
    if (autoCloseRef.current) {
      clearTimeout(autoCloseRef.current);
      autoCloseRef.current = null;
    }
  }

  function handleMouseLeave() {
    if (!expanded) return;
    isHoveringRef.current = false;
    if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    autoCloseRef.current = setTimeout(() => {
      setExpanded(false);
      autoCloseRef.current = null;
    }, AUTO_CLOSE_MS);
  }

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    didDrag.current = false;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };

    let dragInitiated = false;
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    const onMove = async (me: MouseEvent) => {
      const dx = Math.abs(me.clientX - mouseDownPos.current.x);
      const dy = Math.abs(me.clientY - mouseDownPos.current.y);
      if ((dx > 6 || dy > 6) && !dragInitiated) {
        dragInitiated = true;
        didDrag.current = true;
        try { await getCurrentWindow().startDragging(); }
        catch { didDrag.current = false; }
        finally { cleanup(); }
      }
    };
    const onUp = () => cleanup();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (didDrag.current) return;
    const wasExpanded = expanded;
    if (!wasExpanded) isHoveringRef.current = true;
    setExpanded(!wasExpanded);
  }, [expanded]);

  async function handleDone() {
    if (tasks.length === 0) return;
    const taskToComplete = tasks[currentIndex];
    if (!taskToComplete) return;
    const nextIndex = currentIndex >= tasks.length - 1 ? 0 : currentIndex;
    try {
      await invoke("complete_task", { id: taskToComplete.id });
      const all = await invoke<Task[]>("get_incomplete_tasks");
      setTasks(all);
      if (all.length === 0) setExpanded(false);
      setCurrentIndex(nextIndex);
    } catch (e) {
      console.error("[CompactPill] Failed to complete task:", e);
      refresh().catch(() => {});
    }
  }

  function handleNext() {
    setCurrentIndex(i => (i + 1) % Math.max(tasks.length, 1));
  }

  function handlePrev() {
    setCurrentIndex(i => (i - 1 + Math.max(tasks.length, 1)) % Math.max(tasks.length, 1));
  }

  const currentTask = tasks[currentIndex];

  if (expanded && tasks.length > 0) {
    return (
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: EXPANDED_W,
          height: EXPANDED_H,
          background: "var(--pill-bg, #060608)",
          border: "0.55px solid #e8e8e8",
          boxShadow: timerBorderColor ? `0 0 0 1px ${timerBorderColor}` : "none",
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
    );
  }

  return (
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        style={{
          width: COLLAPSED_W,
          height: COLLAPSED_H,
          background: "var(--pill-bg, #060608)",
          border: "0.55px solid #e8e8e8",
          boxShadow: timerBorderColor ? `0 0 0 1px ${timerBorderColor}` : "none",
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
          <span style={{ fontSize: "11px", color: "var(--pill-text, #ffffff)", fontFamily: "'Geist Mono', monospace", fontWeight: 600, whiteSpace: "nowrap" }}>
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </span>
        </>
      )}
    </div>
  );
}
