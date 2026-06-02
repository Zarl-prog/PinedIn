import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";

interface TaskCardProps {
  taskId: number;
  title: string;
  description: string;
  urgency: string;
  dueTime: string;
}

const COLLAPSED_H = 90;
const EXPANDED_H = 220;
const REMIND_H = 270;

const REMIND_OPTIONS = [5, 15, 30, 60] as const;

const URGENCY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "rgba(239,68,68,0.15)", text: "#ef4444", border: "rgba(239,68,68,0.3)" },
  medium: { bg: "rgba(245,158,11,0.15)", text: "#f59e0b", border: "rgba(245,158,11,0.3)" },
  low: { bg: "rgba(34,197,94,0.15)", text: "#22c55e", border: "rgba(34,197,94,0.3)" },
};

export default function TaskCard({ taskId, title, description, urgency, dueTime }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRemindPicker, setShowRemindPicker] = useState(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const uc = URGENCY_COLORS[urgency] ?? URGENCY_COLORS.medium;

  const resize = useCallback((h: number) => {
    getCurrentWindow().setSize(new LogicalSize(280, h));
  }, []);

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    if ((e.target as HTMLElement).closest("button")) return;
    await getCurrentWindow().startDragging();
  }, []);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const dx = Math.abs(e.clientX - mouseDownPos.current.x);
    const dy = Math.abs(e.clientY - mouseDownPos.current.y);
    if (dx < 5 && dy < 5) {
      const next = !expanded;
      setExpanded(next);
      setShowRemindPicker(false);
      resize(next ? EXPANDED_H : COLLAPSED_H);
    }
  }, [expanded, resize]);

  const handleDone = useCallback(async () => {
    await invoke("complete_task", { id: taskId });
    await getCurrentWindow().close();
  }, [taskId]);

  const handleSnooze = useCallback(async () => {
    await invoke("snooze_task", { id: taskId });
  }, [taskId]);

  const handleRemindClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !showRemindPicker;
    setShowRemindPicker(next);
    resize(next ? REMIND_H : EXPANDED_H);
  }, [showRemindPicker, resize]);

  const handleRemindConfirm = useCallback(async (minutes: number) => {
    await invoke("remind_task", { id: taskId, minutes });
  }, [taskId]);

  return (
    <motion.div
      animate={{ height: showRemindPicker ? REMIND_H : expanded ? EXPANDED_H : COLLAPSED_H }}
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
      {/* Collapsed header — always visible */}
      <div style={{ padding: "14px 16px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {title}
          </span>
          <span style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "999px", marginLeft: "8px", flexShrink: 0, background: uc.bg, color: uc.text, border: `1px solid ${uc.border}` }}>
            {urgency}
          </span>
        </div>
        {description && (
          <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.38)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block", marginTop: "4px" }}>
            {description}
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
          {dueTime && (
            <div style={{ padding: "0 16px 10px", fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>
              📅 {dueTime}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: "8px", padding: "0 14px 14px" }}>
            <button onClick={(e) => { e.stopPropagation(); handleDone(); }} style={btnStyle("rgba(34,197,94,0.12)", "#22c55e", "rgba(34,197,94,0.25)")}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.22)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(34,197,94,0.12)"; }}>
              ✓ Done
            </button>
            <button onClick={(e) => { e.stopPropagation(); handleSnooze(); }} style={btnStyle("rgba(245,158,11,0.12)", "#f59e0b", "rgba(245,158,11,0.25)")}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(245,158,11,0.22)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(245,158,11,0.12)"; }}>
              💤 Snooze
            </button>
            <button onClick={handleRemindClick} style={btnStyle("rgba(139,92,246,0.12)", "#8b5cf6", "rgba(139,92,246,0.25)")}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.22)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; }}>
              🔔 Remind
            </button>
          </div>

          {/* Remind time picker */}
          {showRemindPicker && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.12 }}
              style={{ padding: "0 14px 14px" }}>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>Remind me in…</div>
              <div style={{ display: "flex", gap: "6px" }}>
                {REMIND_OPTIONS.map((mins) => (
                  <button key={mins} onClick={(e) => { e.stopPropagation(); handleRemindConfirm(mins); }}
                    style={{ flex: 1, padding: "6px 0", borderRadius: "7px", background: "rgba(139,92,246,0.1)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.2)", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.25)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; }}>
                    {mins < 60 ? `${mins}m` : "1h"}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function btnStyle(bg: string, color: string, border: string): React.CSSProperties {
  return { flex: 1, padding: "8px", borderRadius: "8px", background: bg, color, border: `1px solid ${border}`, fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "background 0.15s ease" };
}
