import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CheckCircle, ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import type { Task } from "../lib/tauriCommands";

export default function EdgePeek() {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hovered, setHovered] = useState(false);

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
    const unlisten = listen("tasks-updated", refresh);
    return () => { unlisten.then(f => f()); };
  }, []);

  useEffect(() => {
    const unlistenExpand = listen("edge_peek_expanded", () => setExpanded(true));
    const unlistenCollapse = listen("edge_peek_collapsed", () => setExpanded(false));
    return () => {
      unlistenExpand.then(f => f());
      unlistenCollapse.then(f => f());
    };
  }, []);

  async function handleClick() {
    if (expanded) {
      await invoke("collapse_edge_peek");
    } else {
      await invoke("expand_edge_peek");
    }
  }

  async function handleDone(id: number | undefined | null) {
    if (!id) return;
    await invoke("complete_task", { id });
    refresh();
  }

  return (
    <div style={{
      width: "100%",
      height: "100%",
      background: "transparent",
      display: "flex",
      justifyContent: "flex-end",
      alignItems: "center",
      overflow: "hidden"
    }}>
      <AnimatePresence mode="wait">
        {!expanded ? (
          <motion.div
            key="handle"
            initial={{ x: 20 }}
            animate={{
              x: 0,
              scale: hovered ? 1.05 : 1,
            }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onClick={handleClick}
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#0a0a0a",
              border: "2px solid #7c3aed",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              boxShadow: hovered
                ? "0 0 20px rgba(124,58,237,0.4), -4px 0 20px rgba(0,0,0,0.6)"
                : "-4px 0 20px rgba(0,0,0,0.6)",
              userSelect: "none",
              marginRight: "-55px",
              transition: "box-shadow 0.2s",
              position: "relative",
            }}
          >
            <span style={{
              fontSize: "18px",
              fontWeight: 700,
              color: "#ffffff",
              fontFamily: "'Geist Mono', monospace",
              lineHeight: 1,
            }}>
              {tasks.length}
            </span>
            <span style={{
              fontSize: "9px",
              color: "rgba(255,255,255,0.4)",
              fontFamily: "'Geist Mono', monospace",
              letterSpacing: "0.05em",
            }}>
              {tasks.length === 1 ? "task" : "tasks"}
            </span>

            <motion.div
              animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.08, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              style={{
                position: "absolute",
                inset: -4,
                borderRadius: "50%",
                border: "1px solid rgba(124,58,237,0.4)",
                pointerEvents: "none",
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="panel"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
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
            <div style={{
              padding: "16px",
              borderBottom: "1px solid #111",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#7c3aed",
                }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>
                  Active Tasks
                </span>
                <span style={{ fontSize: "11px", color: "#444" }}>
                  {tasks.length}
                </span>
              </div>
              <button
                onClick={handleClick}
                style={{
                  background: "transparent",
                  border: "1px solid #1a1a1a",
                  borderRadius: "6px",
                  padding: "4px 8px",
                  color: "#444",
                  cursor: "pointer",
                  fontSize: "11px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                }}
              >
                <ArrowRight size={12} weight="light" /> Hide
              </button>
            </div>

            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}>
              {tasks.length === 0 ? (
                <div style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#333",
                  fontSize: "12px",
                }}>
                  ✓ All clear
                </div>
              ) : (
                tasks.map(task => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28 }}
                    style={{
                      background: "#0a0a0a",
                      border: "1px solid #1a1a1a",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = "#2a2a2a"}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#1a1a1a"}
                  >
                    <div style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#ffffff",
                      lineHeight: 1.3,
                    }}>
                      {task.title}
                    </div>

                    {task.description && (
                      <div style={{
                        fontSize: "11px",
                        color: "rgba(255,255,255,0.38)",
                        lineHeight: 1.4,
                      }}>
                        {task.description}
                      </div>
                    )}

                    {task.due_time && (
                      <div style={{
                        fontSize: "10px",
                        color: "rgba(255,255,255,0.25)",
                      }}>
                        📅 {task.due_time}
                      </div>
                    )}

                    <button
                      onClick={() => handleDone(task.id)}
                      style={{
                        marginTop: "4px",
                        padding: "6px",
                        borderRadius: "7px",
                        border: "1px solid rgba(124,58,237,0.3)",
                        background: "rgba(124,58,237,0.1)",
                        color: "#7c3aed",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Geist Mono', monospace",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px",
                        transition: "all 0.12s",
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = "rgba(124,58,237,0.2)";
                        e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = "rgba(124,58,237,0.1)";
                        e.currentTarget.style.borderColor = "rgba(124,58,237,0.3)";
                      }}
                    >
                      <CheckCircle size={13} weight="light" /> Mark Done
                    </button>
                  </motion.div>
                ))
              )}
            </div>

            <div style={{
              height: "3px",
              background: "linear-gradient(90deg, transparent, #7c3aed, transparent)",
              flexShrink: 0,
            }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
