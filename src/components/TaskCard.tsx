import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

interface TaskCardProps {
  taskId: number;
  title: string;
  description: string;
  urgency: string;
  dueTime: string;
}

const URGENCY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", border: "rgba(239,68,68,0.3)" },
  medium: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  low: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", border: "rgba(34,197,94,0.3)" },
};

export default function TaskCard({ taskId, title, description, urgency, dueTime }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isDragging = useRef(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const uc = URGENCY_COLORS[urgency] ?? URGENCY_COLORS.medium;

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    // Capture starting position to distinguish click from drag
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    // Don't initiate drag if clicking a button
    if ((e.target as HTMLElement).closest("button")) return;
    isDragging.current = true;
    await getCurrentWindow().startDragging();
    isDragging.current = false;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    // Only toggle if the mouse didn't move — i.e., it was a click, not a drag
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    if (dx < 5 && dy < 5) {
      setExpanded((prev) => !prev);
    }
  }, []);

  const handleDone = useCallback(async () => {
    await invoke("complete_task", { id: taskId });
    await getCurrentWindow().close();
  }, [taskId]);

  const handleSnooze = useCallback(async () => {
    await invoke("snooze_task", { id: taskId });
    // Rust side closes this window and schedules reopen in 30 min
  }, [taskId]);

  const handleRemind = useCallback(async () => {
    await invoke("remind_task", { id: taskId });
  }, [taskId]);

  return (
    <motion.div
      animate={{ height: expanded ? 220 : 90 }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      style={{
        background: "#16161a",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
        overflow: "hidden",
        width: "280px",
        cursor: "grab",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Collapsed content (always visible) */}
      <div style={{ padding: "14px 16px", flex: 1, minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span
            style={{
              fontSize: "14px",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: "10px",
              padding: "2px 7px",
              borderRadius: "999px",
              marginLeft: "8px",
              flexShrink: 0,
              background: uc.bg,
              color: uc.text,
              border: `1px solid ${uc.border}`,
            }}
          >
            {urgency}
          </span>
        </div>
        {description && (
          <span
            style={{
              fontSize: "12px",
              color: "rgba(255,255,255,0.38)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
              marginTop: "4px",
            }}
          >
            {description}
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
        >
          {dueTime && (
            <div style={{ padding: "0 16px 10px", fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>
              📅 {dueTime}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "8px", padding: "0 14px 14px" }}>
            <button
              onClick={(e) => { e.stopPropagation(); handleDone(); }}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                background: "rgba(34,197,94,0.12)",
                color: "#22c55e",
                border: "1px solid rgba(34,197,94,0.25)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.12)"; }}
            >
              ✓ Done
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleSnooze(); }}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                background: "rgba(245,158,11,0.12)",
                color: "#f59e0b",
                border: "1px solid rgba(245,158,11,0.25)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(245,158,11,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(245,158,11,0.12)"; }}
            >
              💤 Snooze
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleRemind(); }}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: "8px",
                background: "rgba(139,92,246,0.12)",
                color: "#8b5cf6",
                border: "1px solid rgba(139,92,246,0.25)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.2)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}
            >
              🔔 Remind
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
