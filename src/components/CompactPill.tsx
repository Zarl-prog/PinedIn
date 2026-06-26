import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../lib/tauriCommands";

const COLLAPSED_W = 140;
const COLLAPSED_H = 40;
const EXPANDED_W = 240;
const EXPANDED_H = 140;

export default function CompactPill() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [timerBorderColor, setTimerBorderColor] = useState<string | null>(null);
  const peekTimer = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const recalcTimerBorder = useCallback(() => {
    setTasks(current => {
      const color = current.reduce<string | null>((acc, t) => {
        const c = getTimerColor(t);
        if (!acc && c) return c;
        return acc;
      }, null);
      setTimerBorderColor(color);
      return current; // no actual state change, just side-effectful read
    });
  }, []); // no deps — reads tasks via setState callback to avoid stale closure

  async function refresh() {
    const all = await invoke<Task[]>("get_incomplete_tasks");
    setTasks(all);
  }

  useEffect(() => {
    refresh();
    const unlisten = listen("tasks-updated", refresh);
    return () => {
      unlisten.then(f => f());
      if (peekTimer.current) clearInterval(peekTimer.current);
    };
  }, []);

  // Re-assert always-on-top + skip-taskbar (GNOME/Wayland workaround)
  useEffect(() => {
    invoke("reassert_window_properties");
    const timer = setTimeout(() => invoke("reassert_window_properties"), 500);
    return () => clearTimeout(timer);
  }, []);

  // 1-second interval only when timed tasks exist
  useEffect(() => {
    const hasTimed = tasks.some(t => t.time_limit_minutes && t.started_at);
    if (!hasTimed) {
      setTimerBorderColor(null);
      return;
    }
    recalcTimerBorder();
    const id = setInterval(recalcTimerBorder, 1000);
    return () => clearInterval(id);
  }, [tasks, recalcTimerBorder]);

  useEffect(() => {
    const win = getCurrentWindow();
    if (expanded && tasks.length > 0) {
      win.setSize(new LogicalSize(EXPANDED_W, EXPANDED_H));
    } else {
      win.setSize(new LogicalSize(COLLAPSED_W, COLLAPSED_H));
    }
  }, [expanded, tasks.length]);

  function handleClick() {
    if (peekTimer.current) {
      clearInterval(peekTimer.current);
      peekTimer.current = null;
      setExpanded(false);
      return;
    }
    if (tasks.length > 0) {
      setExpanded(p => !p);
    }
  }

  function handleDoubleClick() {
    if (tasks.length === 0) return;
    if (peekTimer.current) {
      clearInterval(peekTimer.current);
      peekTimer.current = null;
    }
    setExpanded(true);
    setCurrentIndex(0);
    peekTimer.current = setInterval(() => {
      if (peekTimer.current) clearInterval(peekTimer.current);
      peekTimer.current = null;
      setExpanded(false);
    }, 4000);
  }

  async function handleDone() {
    if (tasks.length === 0) return;
    const taskToComplete = tasks[currentIndex];
    if (!taskToComplete) return;
    const nextIndex = currentIndex >= tasks.length - 1 ? 0 : currentIndex;
    await invoke("complete_task", { id: taskToComplete.id });
    await refresh();
    setCurrentIndex(nextIndex);
  }

  function handleNext() {
    setCurrentIndex(i => (i + 1) % tasks.length);
  }

  function handlePrev() {
    setCurrentIndex(i => (i - 1 + tasks.length) % tasks.length);
  }

  const currentTask = tasks[currentIndex];

  const dotColor = tasks.some(t => t.urgency === "critical")
    ? "#ef4444"
    : tasks.some(t => t.urgency === "medium")
      ? "#f59e0b"
      : "#22c55e";

  const wrapperStyle: CSSProperties = {
    background: "transparent",
    padding: "2px",
    boxSizing: "border-box",
    height: expanded && tasks.length > 0 ? "auto" : "100%",
  };

  const pillStyle: React.CSSProperties = {
    background: "var(--pill-bg, var(--card-bg, #060608))",
    border: `1.5px solid ${timerBorderColor || "var(--pill-border, var(--card-border, #1a1a1a))"}`,
    borderRadius: "999px",
    boxShadow: "var(--pill-shadow, 0 4px 16px rgba(0,0,0,0.5))",
    overflow: "hidden",
    cursor: "pointer",
    userSelect: "none",
    display: "flex",
    flexDirection: "column",
    transition: "border-color 0.5s ease",
    width: "100%",
  };

  return (
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={async (e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        await getCurrentWindow().startDragging();
      }}
      style={wrapperStyle}
    >
      <div style={pillStyle}>
        <div style={{
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          padding: "0 14px",
          flexShrink: 0,
        }}>
          {tasks.length === 0 ? (
            <span style={{ fontSize: "11px", color: "var(--pill-text-muted, var(--card-text-muted, #444))", fontFamily: "'Geist Mono', monospace" }}>✓ All clear</span>
          ) : (
            <>
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
              <span style={{ fontSize: "11px", color: "var(--pill-text, var(--card-text-primary, #ffffff))", fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>
                {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
              </span>
            </>
          )}
        </div>

        <AnimatePresence>
          {expanded && tasks.length > 0 && currentTask && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                padding: "0 12px 10px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                borderTop: "1px solid var(--divider, #151515)",
                overflow: "hidden",
              }}
            >
              <div style={{ paddingTop: "8px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--pill-text, var(--card-text-primary, #ffffff))", fontFamily: "'Geist Mono', monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {currentTask.title}
                </div>
                <div style={{ fontSize: "10px", color: "var(--pill-text-muted, var(--card-text-secondary, #555))", marginTop: "2px", fontFamily: "'Geist Mono', monospace" }}>
                  {currentIndex + 1} / {tasks.length}
                </div>
              </div>

              <div style={{ display: "flex", gap: "5px" }}>
                <button onClick={(e) => { e.stopPropagation(); handlePrev(); }} style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid var(--pill-border, var(--card-border, #1a1a1a))", background: "transparent", color: "var(--pill-text-muted, var(--card-text-muted, #777))", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ‹
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDone(); }} style={{ flex: 1, height: "24px", borderRadius: "5px", border: "1px solid var(--btn-done-border, rgba(34,197,94,0.3))", background: "var(--btn-done-bg, rgba(34,197,94,0.1))", color: "var(--btn-done-text, #22c55e)", fontSize: "10px", fontWeight: 600, cursor: "pointer", fontFamily: "'Geist Mono', monospace" }}>
                  ✓ Done
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleNext(); }} style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid var(--pill-border, var(--card-border, #1a1a1a))", background: "transparent", color: "var(--pill-text-muted, var(--card-text-muted, #777))", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  ›
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
