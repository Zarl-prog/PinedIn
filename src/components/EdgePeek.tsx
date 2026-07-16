import { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize, LogicalPosition } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import type { Task } from "../lib/tauriCommands";
import { Check, CaretLeft, CaretRight } from "@phosphor-icons/react";

const HANDLE_SIZE = 48;
const VISIBLE_PX = 14;
const EXPANDED_W = 260;
const EXPANDED_H = 200;
const AUTO_CLOSE_MS = 3000;

type Edge = "left" | "right" | "top" | "bottom";

function getEdgePosition(
  edge: Edge,
  screenW: number,
  screenH: number,
  expanded: boolean,
): { x: number; y: number; w: number; h: number } {
  if (expanded) {
    switch (edge) {
      case "left":
        return { x: 0, y: (screenH - EXPANDED_H) / 2, w: EXPANDED_W, h: EXPANDED_H };
      case "right":
        return { x: screenW - EXPANDED_W, y: (screenH - EXPANDED_H) / 2, w: EXPANDED_W, h: EXPANDED_H };
      case "top":
        return { x: (screenW - EXPANDED_W) / 2, y: 0, w: EXPANDED_W, h: EXPANDED_H };
      case "bottom":
        return { x: (screenW - EXPANDED_W) / 2, y: screenH - EXPANDED_H, w: EXPANDED_W, h: EXPANDED_H };
    }
  }
  const off = HANDLE_SIZE - VISIBLE_PX;
  switch (edge) {
    case "left":
      return { x: -off, y: (screenH / 2) - (HANDLE_SIZE / 2), w: HANDLE_SIZE, h: HANDLE_SIZE };
    case "right":
      return { x: screenW - VISIBLE_PX, y: (screenH / 2) - (HANDLE_SIZE / 2), w: HANDLE_SIZE, h: HANDLE_SIZE };
    case "top":
      return { x: (screenW / 2) - (HANDLE_SIZE / 2), y: -off, w: HANDLE_SIZE, h: HANDLE_SIZE };
    case "bottom":
      return { x: (screenW / 2) - (HANDLE_SIZE / 2), y: screenH - VISIBLE_PX, w: HANDLE_SIZE, h: HANDLE_SIZE };
  }
}

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

export default function EdgePeek() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [edge, setEdge] = useState<Edge>("right");
  const [autoHide, setAutoHide] = useState(false);
  const [interaction, setInteraction] = useState<"click" | "doubleclick">("doubleclick");
  const [timerBorderColor, setTimerBorderColor] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [screenSize, setScreenSize] = useState({ w: 1920, h: 1080 });

  const didDrag = useRef(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const isHoveringRef = useRef(false);
  const autoCloseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const allClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const rafId = useRef<number | null>(null);
  const targetPos = useRef({ x: 0, y: 0 });

  const recalcTimerBorder = useCallback(() => {
    const color = tasks.reduce<string | null>((acc, t) => {
      const c = getTimerColor(t);
      if (!acc && c) return c;
      return acc;
    }, null);
    setTimerBorderColor(color);
  }, [tasks]);

  async function refresh() {
    try {
      const all = await invoke<Task[]>("get_incomplete_tasks");
      setTasks(all);
    } catch (e) {
      console.error("[EdgePeek] Failed to fetch tasks:", e);
    }
  }

  async function loadSettings() {
    try {
      const pos = await invoke<string>("get_edge_peek_position");
      setEdge(pos as Edge);
      const ah = await invoke<boolean>("get_edge_peek_auto_hide");
      setAutoHide(ah);
      const it = await invoke<string>("get_edge_peek_interaction");
      setInteraction(it as "click" | "doubleclick");
    } catch (e) {
      console.error("[EdgePeek] Failed to load settings:", e);
    }
  }

  async function loadScreenSize() {
    try {
      const size = await invoke<[number, number]>("get_monitor_size");
      setScreenSize({ w: size[0], h: size[1] });
    } catch (_) {}
  }

  useEffect(() => {
    refresh();
    loadSettings();
    loadScreenSize();
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
  }, [tasks, recalcTimerBorder]);

  useEffect(() => {
    const win = getCurrentWindow();
    const pos = getEdgePosition(edge, screenSize.w, screenSize.h, expanded);
    win.setPosition(new LogicalPosition(pos.x, pos.y));
    win.setSize(new LogicalSize(pos.w, pos.h));
  }, [edge, expanded, screenSize]);

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
    if (isHoveringRef.current) return;
    autoCloseRef.current = setTimeout(() => {
      setExpanded(false);
      autoCloseRef.current = null;
    }, AUTO_CLOSE_MS);
    return () => {
      if (autoCloseRef.current) clearTimeout(autoCloseRef.current);
    };
  }, [expanded]);

  useEffect(() => {
    if (!autoHide || expanded) return;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      const win = getCurrentWindow();
      const pos = getEdgePosition(edge, screenSize.w, screenSize.h, false);
      win.setPosition(new LogicalPosition(pos.x, pos.y));
    }, 5000);
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [autoHide, expanded, edge, screenSize]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    didDrag.current = false;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };

    let dragInitiated = false;
    const win = getCurrentWindow();

    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      setIsDragging(false);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
    };

    const onMove = (me: MouseEvent) => {
      const dx = Math.abs(me.clientX - mouseDownPos.current.x);
      const dy = Math.abs(me.clientY - mouseDownPos.current.y);
      if ((dx > 6 || dy > 6) && !dragInitiated) {
        dragInitiated = true;
        didDrag.current = true;
        setIsDragging(true);
        win.outerPosition().then(pos => {
          const scale = win.scaleFactor().then(s => {
            dragOffset.current = {
              x: me.screenX - (pos.x / s),
              y: me.screenY - (pos.y / s),
            };
          });
        });
      }
      if (dragInitiated) {
        targetPos.current = {
          x: me.screenX - dragOffset.current.x,
          y: me.screenY - dragOffset.current.y,
        };
        if (rafId.current === null) {
          rafId.current = requestAnimationFrame(() => {
            rafId.current = null;
            win.setPosition(new LogicalPosition(targetPos.current.x, targetPos.current.y));
          });
        }
      }
    };

    const onUp = () => {
      cleanup();
      if (dragInitiated) {
        const sx = targetPos.current.x;
        const sy = targetPos.current.y;
        const sw = screenSize.w;
        const sh = screenSize.h;

        const distLeft = sx;
        const distRight = sw - sx;
        const distTop = sy;
        const distBottom = sh - sy;

        const minDist = Math.min(distLeft, distRight, distTop, distBottom);

        let newEdge: Edge = edge;
        if (minDist === distLeft) newEdge = "left";
        else if (minDist === distRight) newEdge = "right";
        else if (minDist === distTop) newEdge = "top";
        else if (minDist === distBottom) newEdge = "bottom";

        setEdge(newEdge);
        invoke("set_edge_peek_position", { position: newEdge }).catch(() => {});
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [edge, screenSize]);

  const handleExpand = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (didDrag.current) return;
    const wasExpanded = expanded;
    if (!wasExpanded) isHoveringRef.current = true;
    setExpanded(!wasExpanded);
  }, [expanded]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (interaction === "click") handleExpand(e);
  }, [interaction, handleExpand]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (interaction === "doubleclick") handleExpand(e);
  }, [interaction, handleExpand]);

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
      console.error("[EdgePeek] Failed to complete task:", e);
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

  const handlePosStyle: React.CSSProperties =
    edge === "left"
      ? { right: 0, top: "50%", transform: "translate(50%, -50%)" }
      : edge === "right"
        ? { left: 0, top: "50%", transform: "translate(-50%, -50%)" }
        : edge === "top"
          ? { bottom: 0, left: "50%", transform: "translate(-50%, 50%)" }
          : { top: 0, left: "50%", transform: "translate(-50%, -50%)" };

  const panelVariants = {
    hidden: {
      opacity: 0,
      [edge === "left" ? "x" : edge === "right" ? "x" : edge === "top" ? "y" : "y"]:
        edge === "left" ? -10 : edge === "right" ? 10 : edge === "top" ? -10 : 10,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 30 },
    },
  };

  const timerStroke = timerBorderColor || "#333";

  return (
    <div
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      style={{
        width: expanded ? EXPANDED_W : HANDLE_SIZE,
        height: expanded ? EXPANDED_H : HANDLE_SIZE,
        background: expanded ? "var(--pill-bg, #060608)" : "transparent",
        border: expanded ? "0.65px solid #e8e8e8" : "none",
        borderRadius: expanded ? "16px" : "0",
        position: "relative",
        overflow: "visible",
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
        boxSizing: "border-box",
      }}
    >
      {!expanded && (
        <motion.div
          animate={{
            scale: isDragging ? 0.95 : 1,
          }}
          transition={{
            scale: { type: "spring", stiffness: 400, damping: 20 },
          }}
          style={{
            position: "absolute",
            ...handlePosStyle,
            width: HANDLE_SIZE,
            height: HANDLE_SIZE,
            background: "var(--pill-bg, #060608)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 0 8px rgba(0,0,0,0.5)",
          }}
        >
          <svg
            width={HANDLE_SIZE}
            height={HANDLE_SIZE}
            viewBox={`0 0 ${HANDLE_SIZE} ${HANDLE_SIZE}`}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            <circle
              cx={HANDLE_SIZE / 2}
              cy={HANDLE_SIZE / 2}
              r={HANDLE_SIZE / 2 - 2}
              fill="none"
              stroke={timerStroke}
              strokeWidth="1.5"
            />
          </svg>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--pill-text, #ffffff)",
              fontFamily: "'Geist Mono', monospace",
              zIndex: 1,
              lineHeight: 1,
            }}
          >
            {tasks.length}
          </span>
        </motion.div>
      )}

      <AnimatePresence>
        {expanded && (
          <motion.div
            key="panel"
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={panelVariants}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              padding: "10px 14px",
              overflow: "hidden",
            }}
          >
            {tasks.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  fontSize: "11px",
                  color: "var(--pill-text-muted, #777)",
                  fontFamily: "'Geist Mono', monospace",
                  gap: "4px",
                }}
              >
                <Check size={14} weight="light" /> All clear
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--pill-text, #ffffff)",
                      fontFamily: "'Geist Mono', monospace",
                      fontWeight: 600,
                    }}
                  >
                    {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--pill-text, #ffffff)",
                    fontFamily: "'Geist Mono', monospace",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {currentTask?.title}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--pill-text-muted, #777)",
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  {currentIndex + 1} / {tasks.length}
                </div>
                <div style={{ display: "flex", gap: "5px" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrev(); }}
                    style={{
                      width: "24px", height: "24px", borderRadius: "5px",
                      border: "1px solid var(--pill-border, #1a1a1a)",
                      background: "transparent", color: "var(--pill-text-muted, #777)",
                      fontSize: "12px", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <CaretLeft size={14} weight="light" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDone(); }}
                    style={{
                      flex: 1, height: "24px", borderRadius: "5px",
                      border: "1px solid var(--btn-done-border, rgba(34,197,94,0.3))",
                      background: "var(--btn-done-bg, rgba(34,197,94,0.1))",
                      color: "var(--btn-done-text, #22c55e)",
                      fontSize: "10px", fontWeight: 600, cursor: "pointer",
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center" }}>
                      <Check size={14} weight="light" /> Done
                    </span>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleNext(); }}
                    style={{
                      width: "24px", height: "24px", borderRadius: "5px",
                      border: "1px solid var(--pill-border, #1a1a1a)",
                      background: "transparent", color: "var(--pill-text-muted, #777)",
                      fontSize: "12px", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <CaretRight size={14} weight="light" />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
