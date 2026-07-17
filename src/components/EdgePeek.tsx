import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CheckCircle, ArrowRight } from "@phosphor-icons/react";
import type { Task } from "../lib/tauriCommands";

/**
 * Edge peek UI.
 *
 * Window geometry is owned entirely by the Rust side (right-edge anchored,
 * fully on-screen). This component only toggles content after the window
 * has been resized — never animates layout against a changing outer window,
 * which used to look like random teleporting.
 */
export default function EdgePeek() {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const isAnimating = useRef(false);

  // Load persisted expanded state on mount
  useEffect(() => {
    invoke<boolean>("get_edge_peek_expanded").then(setExpanded).catch(() => {});
  }, []);

  async function refresh() {
    try {
      const all = await invoke<Task[]>("get_incomplete_tasks");
      setTasks(all);
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    refresh();
    const unlistenTasks = listen("tasks-updated", refresh);
    const unlistenAutoHide = listen("edge_peek_auto_hide", () => {
      if (expanded) {
        handleClick(); // collapse
      }
    });
    return () => {
      unlistenTasks.then((f) => f());
      unlistenAutoHide.then((f) => f());
    };
  }, []);

  async function handleClick() {
    if (isAnimating.current) return;
    isAnimating.current = true;

    try {
      if (expanded) {
        // Collapse UI first (fits the still-large window: pill hugs the right
        // edge), then shrink the native window so the pill stays put.
        setExpanded(false);
        // Wait one paint so the pill is rendered before we resize.
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        await new Promise((r) => setTimeout(r, 40));
        await invoke("collapse_edge_peek");
      } else {
        // Grow the native window first (right edge stays flush), then show
        // the panel. No CSS slide of the whole panel — that fought the OS
        // resize and read as a teleport.
        await invoke("expand_edge_peek");
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        setExpanded(true);
      }
    } catch (e) {
      console.error("[EdgePeek] toggle failed:", e);
    } finally {
      isAnimating.current = false;
    }
  }

  async function handleDone(id: number | undefined | null) {
    if (!id) return;
    await invoke("complete_task", { id });
    refresh();
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {expanded ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              width: "100%",
              height: "100%",
              background: "#000000",
              border: "1px solid #1a1a1a",
              borderRadius: "16px 0 0 16px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #111",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
                background: "#000",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#ffffff",
                  fontFamily: "'Geist Mono', monospace",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                }}
              >
                Tasks &middot; {tasks.length}
              </span>
              <button
                onClick={handleClick}
                style={{
                  background: "transparent",
                  border: "1px solid #1a1a1a",
                  borderRadius: "6px",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#444",
                  cursor: "pointer",
                  transition: "border-color 0.12s, color 0.12s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#333";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#1a1a1a";
                  e.currentTarget.style.color = "#444";
                }}
              >
                <ArrowRight size={13} weight="light" />
              </button>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "12px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {tasks.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#333",
                    fontSize: "12px",
                  }}
                >
                  All clear
                </div>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid #1a1a1a",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "#2a2a2a")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "#1a1a1a")
                    }
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#ffffff",
                        lineHeight: 1.3,
                      }}
                    >
                      {task.title}
                    </div>

                    {task.description && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "rgba(255,255,255,0.38)",
                          lineHeight: 1.4,
                        }}
                      >
                        {task.description}
                      </div>
                    )}

                    {task.due_time && (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "rgba(255,255,255,0.25)",
                        }}
                      >
                        due {task.due_time}
                      </div>
                    )}

                    <button
                      onClick={() => handleDone(task.id)}
                      style={{
                        marginTop: "4px",
                        padding: "6px",
                        borderRadius: "7px",
                        border: "1px solid #2a2a2a",
                        background: "transparent",
                        color: "#aaaaaa",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Geist Mono', monospace",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px",
                        transition: "border-color 0.12s, color 0.12s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#444";
                        e.currentTarget.style.color = "#ffffff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#2a2a2a";
                        e.currentTarget.style.color = "#aaaaaa";
                      }}
                    >
                      <CheckCircle size={13} weight="light" /> Mark Done
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="handle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={handleClick}
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#0a0a0a",
              border: "2px solid #2a2a2a",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              boxShadow: "none",
              userSelect: "none",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "20px",
                fontWeight: 700,
                color: "#ffffff",
                fontFamily: "'Geist Mono', monospace",
                lineHeight: 1,
              }}
            >
              {tasks.length}
            </span>
            <span
              style={{
                fontSize: "8px",
                color: "rgba(255,255,255,0.3)",
                fontFamily: "'Geist Mono', monospace",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {tasks.length === 1 ? "task" : "tasks"}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
