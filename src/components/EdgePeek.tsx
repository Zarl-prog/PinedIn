import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CheckCircle, ArrowRight } from "@phosphor-icons/react";
import type { Task } from "../lib/tauriCommands";

export default function EdgePeek() {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hovered, setHovered] = useState(false);
  const isAnimating = useRef(false);

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

  async function handleClick() {
    if (isAnimating.current) return;
    isAnimating.current = true;

    if (expanded) {
      setExpanded(false);
      await new Promise(r => setTimeout(r, 450));
      await invoke("collapse_edge_peek");
    } else {
      await invoke("expand_edge_peek");
      await new Promise(r => setTimeout(r, 50));
      setExpanded(true);
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
      <AnimatePresence mode="wait" onExitComplete={() => { isAnimating.current = false; }}>
        {expanded ? (
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
              height: "2px",
              background: "linear-gradient(90deg, transparent, #7c3aed, transparent)",
              flexShrink: 0,
            }} />

            <div style={{
              padding: "14px 16px",
              borderBottom: "1px solid #111",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
              background: "#000",
            }}>
              <span style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#ffffff",
                fontFamily: "'Geist Mono', monospace",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}>
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
                  transition: "all 0.12s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "#333"; e.currentTarget.style.color = "#fff"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "#1a1a1a"; e.currentTarget.style.color = "#444"; }}
              >
                <ArrowRight size={13} weight="light" />
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
                  All clear
                </div>
              ) : (
                tasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 28, delay: index * 0.04 }}
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
                        due {task.due_time}
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
        ) : (
          <motion.div
            key="handle"
            initial={{ x: 60, opacity: 0 }}
            animate={{
              x: 0,
              opacity: 1,
              scale: hovered ? 1.06 : 1,
            }}
            exit={{ x: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            onClick={handleClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              background: "#0a0a0a",
              border: `2px solid ${hovered ? "#7c3aed" : "#2a2a2a"}`,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "2px",
              marginRight: "-55px",
              boxShadow: hovered
                ? "-6px 0 24px rgba(124,58,237,0.35)"
                : "-4px 0 16px rgba(0,0,0,0.5)",
              transition: "border-color 0.2s, box-shadow 0.2s",
              userSelect: "none",
              position: "relative",
            }}
          >
            <span style={{
              fontSize: "20px",
              fontWeight: 700,
              color: "#ffffff",
              fontFamily: "'Geist Mono', monospace",
              lineHeight: 1,
            }}>
              {tasks.length}
            </span>
            <span style={{
              fontSize: "8px",
              color: "rgba(255,255,255,0.3)",
              fontFamily: "'Geist Mono', monospace",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}>
              {tasks.length === 1 ? "task" : "tasks"}
            </span>

            {tasks.length > 0 && (
              <motion.div
                animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.1, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                style={{
                  position: "absolute",
                  inset: -6,
                  borderRadius: "50%",
                  border: "1px solid rgba(124,58,237,0.3)",
                  pointerEvents: "none",
                }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
