import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../lib/tauriCommands";

export default function CompactPill() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [timerBorderColor, setTimerBorderColor] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  function recalcTimerBorder() {
    const color = tasks.reduce<string | null>((acc, t) => {
      const c = getTimerColor(t);
      if (!acc && c) return c;
      return acc;
    }, null);
    setTimerBorderColor(color);
  }

  async function refresh() {
    const all = await invoke<Task[]>("get_incomplete_tasks");
    setTasks(all);
    setCurrentIndex(0);
  }

  useEffect(() => {
    refresh();
    const unlisten = listen("tasks-updated", refresh);
    return () => { unlisten.then(f => f()); };
  }, []);

  // 1-second interval only when timed tasks exist
  useEffect(() => {
    const hasTimed = tasks.some(t => t.time_limit_minutes && t.started_at);
    if (hasTimed) {
      recalcTimerBorder();
      intervalRef.current = setInterval(recalcTimerBorder, 1000);
    } else {
      setTimerBorderColor(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tasks]);

  useEffect(() => {
    const win = getCurrentWindow();
    if (expanded && tasks.length > 0) {
      win.setSize(new LogicalSize(240, 140));
    } else {
      win.setSize(new LogicalSize(140, 40));
    }
  }, [expanded, tasks.length]);

  function handleClick() {
    if (tasks.length > 0) {
      setExpanded(prev => !prev);
    }
  }

  async function handleDone() {
    if (tasks.length === 0) return;
    await invoke("complete_task", { id: tasks[currentIndex].id });
    await refresh();
    if (currentIndex >= tasks.length - 1) setCurrentIndex(0);
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

  return (
    <motion.div
      onClick={handleClick}
      onMouseDown={async (e) => {
        // Only start drag if clicking the top bar area (not on buttons)
        if ((e.target as HTMLElement).closest("button")) return;
        await getCurrentWindow().startDragging();
      }}
      style={{
        width: "100%",
        height: "100%",
        background: "#000",
        border: `1.5px solid ${timerBorderColor || "#222"}`,
        borderRadius: "999px",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.5s ease, border-radius 0.2s ease",
      }}
    >
      <div style={{
        height: "40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: "0 14px",
        flexShrink: 0
      }}>
        {tasks.length === 0 ? (
          <span style={{ fontSize: "11px", color: "#444", fontFamily: "'Geist Mono', monospace" }}>✓ All clear</span>
        ) : (
          <>
            <span style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: dotColor,
              flexShrink: 0
            }} />
            <span style={{ fontSize: "11px", color: "#ffffff", fontFamily: "'Geist Mono', monospace", fontWeight: 600 }}>
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
              borderTop: "1px solid #111",
              overflow: "hidden",
            }}
          >
            <div style={{ paddingTop: "8px" }}>
              <div style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#ffffff",
                fontFamily: "'Geist Mono', monospace",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}>
                {currentTask.title}
              </div>
              <div style={{ fontSize: "10px", color: "#444", marginTop: "2px", fontFamily: "'Geist Mono', monospace" }}>
                {currentIndex + 1} / {tasks.length}
              </div>
            </div>

            <div style={{ display: "flex", gap: "5px" }}>
              <button
                onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #222", background: "transparent", color: "#666", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ‹
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDone(); }}
                style={{ flex: 1, height: "24px", borderRadius: "5px", border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", color: "#22c55e", fontSize: "10px", fontWeight: 600, cursor: "pointer", fontFamily: "'Geist Mono', monospace" }}
              >
                ✓ Done
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #222", background: "transparent", color: "#666", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ›
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
