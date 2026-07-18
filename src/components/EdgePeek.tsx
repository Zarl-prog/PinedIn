import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { CaretRight, CheckCircle } from "@phosphor-icons/react";
import type { Task } from "../lib/tauriCommands";
import type { CSSProperties } from "react";

/**
 * Edge Peek — right-edge task display.
 *
 * Collapsed: 80×68px pill, vertically centered, right-edge flush.
 *   Content: chevron (16px) + count (17px) + "TASKS" (10px).
 *   Border-radius: 34px 0 0 34px. Colors: #0A0A0A bg, #1A1A1A border, #FFFFFF text, #666666 label.
 *   Hover: border #333333, chevron nudges +4px right.
 *
 * Expanded: 320px wide panel, same vertical center, grows leftward.
 *
 * Window geometry (position/size) is owned by Rust. This component synchronizes
 * with native resize via Tauri events to avoid visual glitches.
 */
export default function EdgePeek() {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hovered, setHovered] = useState(false);
  const isAnimating = useRef(false);
  const resizeListener = useRef<() => void>();

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
      if (expanded) handleClick(); // collapse
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
        // Collapse: trigger native resize, wait for completion event, then update React state
        await invoke("collapse_edge_peek");
        await waitForResizeComplete(false);
        setExpanded(false);
      } else {
        // Expand: trigger native resize, wait for completion event, then update React state
        await invoke("expand_edge_peek");
        await waitForResizeComplete(true);
        setExpanded(true);
      }
    } catch (e) {
      console.error("[EdgePeek] toggle failed:", e);
    } finally {
      isAnimating.current = false;
    }
  }

  function waitForResizeComplete(targetExpanded: boolean): Promise<void> {
    return new Promise((resolve) => {
      // Clean up any existing listener
      if (resizeListener.current) {
        resizeListener.current();
        resizeListener.current = undefined;
      }

      listen("edge-peek-resize-complete", (event) => {
        if (event.payload === targetExpanded) {
          if (resizeListener.current) {
            resizeListener.current();
            resizeListener.current = undefined;
          }
          resolve();
        }
      }).then((unlisten) => {
        resizeListener.current = unlisten;
      });
    });
  }

  async function handleDone(id: number | undefined | null) {
    if (!id) return;
    await invoke("complete_task", { id });
    refresh();
  }

  // ─── Styles ─────────────────────────────────────────────────────────────
  const containerStyle: CSSProperties = {
    width: "100%",
    height: "100%",
    background: "#0A0A0A",
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    overflow: "hidden",
  };

  const pillStyle: CSSProperties = {
    width: "80px",
    height: "68px",
    borderRadius: "34px 0 0 34px",
    background: "#0A0A0A",
    border: `1px solid ${hovered ? "#333333" : "#1A1A1A"}`,
    borderRight: "none",
    cursor: "pointer",
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    paddingLeft: "14px",
    gap: "8px",
    boxShadow: "none",
    userSelect: "none",
    transition: "border-color 0.15s ease",
  };

  const chevronStyle = (isHovered: boolean): CSSProperties => ({
    width: "16px",
    height: "16px",
    color: "#FFFFFF",
    flexShrink: 0,
    transform: isHovered ? "translateX(4px)" : "translateX(0)",
    transition: "transform 0.15s ease",
  });

  const countStyle: CSSProperties = {
    fontSize: "17px",
    fontWeight: 500,
    color: "#FFFFFF",
    fontFamily: "'Geist Mono', monospace",
    lineHeight: 1,
    letterSpacing: "-0.02em",
  };

  const labelStyle: CSSProperties = {
    fontSize: "10px",
    color: "#666666",
    fontFamily: "'Geist Mono', monospace",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    lineHeight: 1,
  };

  const panelStyle: CSSProperties = {
    width: "320px",
    height: "100%",
    background: "#0A0A0A",
    border: "1px solid #1A1A1A",
    borderRadius: "16px 0 0 16px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    fontFamily: "'Geist Mono', monospace",
  };

  return (
    <div style={containerStyle}>
      <AnimatePresence mode="wait" initial={false}>
        {expanded ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={panelStyle}
          >
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #111",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
                background: "#0A0A0A",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#FFFFFF",
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
                  border: "1px solid #1A1A1A",
                  borderRadius: "6px",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#666666",
                  cursor: "pointer",
                  transition: "border-color 0.12s, color 0.12s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#333333";
                  e.currentTarget.style.color = "#FFFFFF";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#1A1A1A";
                  e.currentTarget.style.color = "#666666";
                }}
              >
                <CaretRight size={13} weight="light" />
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
                    color: "#333333",
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
                      background: "#0A0A0A",
                      border: "1px solid #1A1A1A",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                      cursor: "default",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor = "#2A2A2A")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor = "#1A1A1A")
                    }
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#FFFFFF",
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
                        border: "1px solid #2A2A2A",
                        background: "transparent",
                        color: "#AAAAAA",
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
                        e.currentTarget.style.borderColor = "#444444";
                        e.currentTarget.style.color = "#FFFFFF";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#2A2A2A";
                        e.currentTarget.style.color = "#AAAAAA";
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
            key="pill"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={handleClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={pillStyle}
          >
            <CaretRight size={16} weight="light" style={chevronStyle(hovered)} />
            <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
              <span style={countStyle}>{tasks.length}</span>
              <span style={labelStyle}>TASKS</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}