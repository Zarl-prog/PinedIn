import { useState, useEffect, useCallback, useRef, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../lib/tauriCommands";

const MIND_MAP_W = 480;
const MIND_MAP_H = 420;

export default function CompactPill() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [mindMap, setMindMap] = useState(false);
  const [timerBorderColor, setTimerBorderColor] = useState<string | null>(null);
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
      if (clickTimer.current) clearTimeout(clickTimer.current);
    };
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
    if (mindMap) {
      win.setSize(new LogicalSize(MIND_MAP_W, MIND_MAP_H));
    } else if (expanded && tasks.length > 0) {
      win.setSize(new LogicalSize(240, 140));
    } else {
      win.setSize(new LogicalSize(140, 40));
    }
  }, [expanded, tasks.length, mindMap]);

  function handleClick() {
    if (mindMap) {
      setMindMap(false);
      setExpanded(false);
      return;
    }
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      handleDoubleClick();
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      if (tasks.length > 0) {
        setExpanded(p => !p);
      }
    }, 250);
  }

  function handleDoubleClick() {
    if (tasks.length === 0) return;
    setExpanded(false);
    setMindMap(p => !p);
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
    height: mindMap ? "100%" : expanded && tasks.length > 0 ? "auto" : "100%",
  };

  const pillStyle: React.CSSProperties = {
    background: "#060608",
    border: `1.5px solid ${timerBorderColor || "#1a1a1a"}`,
    borderRadius: mindMap ? "12px" : "999px",
    boxShadow: mindMap ? "0 8px 32px rgba(0,0,0,0.6)" : "0 4px 16px rgba(0,0,0,0.5)",
    overflow: "hidden",
    cursor: "pointer",
    userSelect: "none",
    display: "flex",
    flexDirection: "column",
    transition: "border-color 0.5s ease, border-radius 0.2s ease",
    width: "100%",
  };

  async function completeFromMindMap(taskId: number | null) {
    if (!taskId) return;
    await invoke("complete_task", { id: taskId });
    await refresh();
  }

  return (
    <div
      onClick={handleClick}
      onMouseDown={async (e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        await getCurrentWindow().startDragging();
      }}
      style={wrapperStyle}
    >
      <div style={pillStyle}>
        {mindMap && tasks.length > 0 ? (
          <MindMapView
            tasks={tasks}
            width={MIND_MAP_W}
            height={MIND_MAP_H}
            onComplete={completeFromMindMap}
            onClose={() => { setMindMap(false); setExpanded(false); }}
          />
        ) : (
          <>
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
                    borderTop: "1px solid #151515",
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
                    <div style={{ fontSize: "10px", color: "#555", marginTop: "2px", fontFamily: "'Geist Mono', monospace" }}>
                      {currentIndex + 1} / {tasks.length}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "5px" }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                      style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #1a1a1a", background: "transparent", color: "#777", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
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
                      style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #1a1a1a", background: "transparent", color: "#777", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      ›
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Mind Map View ──────────────────────────────────────────────────────────

interface MindMapViewProps {
  tasks: Task[];
  width: number;
  height: number;
  onComplete: (id: number | null) => void;
  onClose: () => void;
}

function MindMapView({ tasks, width, height, onComplete, onClose }: MindMapViewProps) {
  const cx = width / 2;
  const cy = (height - 40) / 2 + 10;
  const radius = Math.min(width, height) * 0.32;

  const positions = tasks.map((_, i) => {
    const angle = (i / tasks.length) * 2 * Math.PI - Math.PI / 2;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  });

  return (
    <div style={{ position: "relative", width, height }}>
      {/* Connecting lines */}
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {positions.map((p, i) => (
          <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#1a1a1a" strokeWidth="1" />
        ))}
        {/* Center glow */}
        <circle cx={cx} cy={cy} r={28} fill="none" stroke="#333" strokeWidth="0.5" opacity={0.4} />
      </svg>

      {/* Center node */}
      <div
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: "absolute",
          left: cx - 24,
          top: cy - 24,
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "#060608",
          border: "1.5px solid #1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          zIndex: 2,
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => e.currentTarget.style.borderColor = "#444"}
        onMouseLeave={(e) => e.currentTarget.style.borderColor = "#1a1a1a"}
        title="Close mind map"
      >
        <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff", fontFamily: "'Geist Mono', monospace" }}>
          {tasks.length}
        </span>
      </div>

      {/* Task nodes */}
      {positions.map((p, i) => (
        <div
          key={tasks[i].id}
          onClick={(e) => { e.stopPropagation(); onComplete(tasks[i].id ?? null); }}
          style={{
            position: "absolute",
            left: p.x - 72,
            top: p.y - 18,
            width: 144,
            height: 36,
            borderRadius: "8px",
            background: "#0a0a0a",
            border: "1px solid #1a1a1a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            zIndex: 2,
            transition: "border-color 0.15s, background 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#22c55e";
            e.currentTarget.style.background = "#0f0f11";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#1a1a1a";
            e.currentTarget.style.background = "#0a0a0a";
          }}
          title="Click to complete"
        >
          <span style={{
            fontSize: "11px",
            color: "#ccc",
            fontFamily: "'Geist Mono', monospace",
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "128px",
            textAlign: "center",
          }}>
            {tasks[i].title}
          </span>
        </div>
      ))}

      {/* Close button top-right */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          width: 24,
          height: 24,
          borderRadius: "6px",
          border: "1px solid #1a1a1a",
          background: "transparent",
          color: "#555",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontFamily: "'Geist Mono', monospace",
          zIndex: 3,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#111";
          e.currentTarget.style.color = "#fff";
          e.currentTarget.style.borderColor = "#444";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "#555";
          e.currentTarget.style.borderColor = "#1a1a1a";
        }}
      >
        ✕
      </button>
    </div>
  );
}
