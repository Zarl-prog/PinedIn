import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../lib/tauriCommands";

export default function CompactPill() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

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

  useEffect(() => {
    const win = getCurrentWindow();
    if (hovered && tasks.length > 0) {
      win.setSize(new LogicalSize(280, 110));
    } else {
      win.setSize(new LogicalSize(120, 36));
    }
  }, [hovered, tasks.length]);

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={async () => await getCurrentWindow().startDragging()}
      style={{
        width: "100%",
        height: "100%",
        background: "#000",
        border: "1px solid #222",
        borderRadius: "18px",
        overflow: "hidden",
        cursor: "grab",
        userSelect: "none",
        display: "flex",
        flexDirection: "column"
      }}
    >
      <div style={{
        height: "36px",
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
        {hovered && tasks.length > 0 && currentTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              padding: "0 12px 10px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              borderTop: "1px solid #111"
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
                onClick={handlePrev}
                style={{ width: "24px", height: "24px", borderRadius: "5px", border: "1px solid #222", background: "transparent", color: "#666", fontSize: "12px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ‹
              </button>
              <button
                onClick={handleDone}
                style={{ flex: 1, height: "24px", borderRadius: "5px", border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", color: "#22c55e", fontSize: "10px", fontWeight: 600, cursor: "pointer", fontFamily: "'Geist Mono', monospace" }}
              >
                ✓ Done
              </button>
              <button
                onClick={handleNext}
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