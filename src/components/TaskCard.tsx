import { useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";

interface TaskCardProps {
  taskId: number;
  title: string;
  description: string;
  urgency: string;
  dueTime: string;
  recurrence?: string | null;
  tags?: string | null;
}

const COLLAPSED_H = 90;
const EXPANDED_H = 220;
const REMIND_H = 270;

const REMIND_OPTIONS = [5, 15, 30, 60] as const;

const URGENCY_CONFIG: Record<string, { color: string; glow: string; bg: string; border: string }> = {
  critical: { color: "#ef4444", glow: "rgba(239,68,68,0.27)", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)" },
  medium: { color: "#f59e0b", glow: "rgba(245,158,11,0.27)", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  low: { color: "#22c55e", glow: "rgba(34,197,94,0.27)", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)" },
};

const BTN_CONFIG = [
  { label: "Done", icon: "\u2713", color: "#22c55e", glow: "rgba(34,197,94,0.27)", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", action: "complete" as const },
  { label: "Snooze", icon: "\uD83D\uDCA4", color: "#f59e0b", glow: "rgba(245,158,11,0.27)", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", action: "snooze" as const },
  { label: "Remind", icon: "\uD83D\uDD14", color: "#a78bfa", glow: "rgba(167,139,250,0.27)", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)", action: "remind" as const },
];

export default function TaskCard({ taskId, title, description, urgency, dueTime, recurrence, tags }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRemindPicker, setShowRemindPicker] = useState(false);
  const [visible, setVisible] = useState(true);
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);

  const uc = URGENCY_CONFIG[urgency] ?? URGENCY_CONFIG.medium;
  const hasRecurrence = !!recurrence;
  const tagList = tags
    ? tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  // Progress bar: how close the due date is (0-100%)
  const progressPercent = useMemo(() => {
    if (!dueTime) return 0;
    const due = new Date(dueTime + "T23:59:59").getTime();
    const now = Date.now();
    const created = now - 7 * 24 * 60 * 60 * 1000; // assume created ~7 days ago if not available
    const total = due - created;
    const elapsed = now - created;
    if (total <= 0) return 100;
    const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
    return Math.round(pct);
  }, [dueTime]);

  const resize = useCallback((h: number) => {
    getCurrentWindow().setSize(new LogicalSize(280, h));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;

    const onMove = async (me: MouseEvent) => {
      if (dragging.current) return;
      const dx = Math.abs(me.clientX - mouseDownPos.current.x);
      const dy = Math.abs(me.clientY - mouseDownPos.current.y);
      if (dx > 4 || dy > 4) {
        dragging.current = true;
        window.removeEventListener("mousemove", onMove);
        await getCurrentWindow().startDragging();
      }
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (dragging.current) return;
    const next = !expanded;
    setExpanded(next);
    setShowRemindPicker(false);
    resize(next ? EXPANDED_H : COLLAPSED_H);
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

  const handleAction = useCallback((action: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (action === "complete") handleDone();
    else if (action === "snooze") handleSnooze();
    else if (action === "remind") handleRemindClick(e);
  }, [handleDone, handleSnooze, handleRemindClick]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      style={{
        position: "relative",
        background: "#16161a",
        borderRadius: "14px",
        border: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
        overflow: "hidden",
        width: "280px",
        cursor: "grab",
        userSelect: "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Left accent bar */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "4px",
          height: "100%",
          background: uc.color,
          borderRadius: "14px 0 0 14px",
        }}
      />

      {/* Collapsed header */}
      <div style={{ padding: "14px 16px 14px 20px", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#ffffff",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              marginRight: "8px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {title}
            {hasRecurrence && (
              <span
                title={`Repeats ${recurrence}`}
                style={{
                  fontSize: "12px",
                  color: uc.color,
                  opacity: 0.6,
                  flexShrink: 0,
                }}
              >
                ↻
              </span>
            )}
          </span>
          <span
            style={{
              fontSize: "10px",
              padding: "2px 10px",
              borderRadius: "999px",
              flexShrink: 0,
              background: uc.bg,
              color: uc.color,
              border: `1px solid ${uc.border}`,
              fontWeight: 600,
              letterSpacing: "0.3px",
              textTransform: "uppercase",
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
              paddingRight: "4px",
            }}
          >
            {description}
          </span>
        )}
      </div>

      {/* Bottom progress bar */}
      <div
        style={{
          width: "100%",
          height: "3px",
          background: "rgba(255,255,255,0.04)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: "100%",
            background: uc.color,
            transition: "width 0.6s ease",
            borderRadius: "0 2px 2px 0",
            opacity: 0.7,
          }}
        />
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
          >
            {description && (
              <div style={{ padding: "8px 16px 6px 20px", fontSize: "12px", color: "rgba(255,255,255,0.55)", lineHeight: 1.5 }}>
                {description}
              </div>
            )}

            {/* Tags */}
            {tagList.length > 0 && (
              <div style={{ padding: "0 16px 8px 20px", display: "flex", flexWrap: "wrap", gap: "4px" }}>
                {tagList.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "1px 7px",
                      borderRadius: "999px",
                      background: "rgba(167,139,250,0.12)",
                      color: "#a78bfa",
                      fontSize: "10px",
                      fontWeight: 500,
                      lineHeight: "16px",
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {dueTime && (
              <div style={{ padding: "0 16px 10px 20px", fontSize: "11px", color: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", gap: "5px" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                {dueTime}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "8px", padding: "0 14px 14px 18px" }}>
              {BTN_CONFIG.map((btn) => (
                <button
                  key={btn.action}
                  onClick={(e) => handleAction(btn.action, e)}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: "8px",
                    background: btn.bg,
                    color: btn.color,
                    border: `1px solid ${btn.border}`,
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "4px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${btn.glow}55`;
                    e.currentTarget.style.boxShadow = `0 0 12px ${btn.glow}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = btn.bg;
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {btn.icon} {btn.label}
                </button>
              ))}
            </div>

            {/* Remind time picker */}
            {showRemindPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                style={{ padding: "0 14px 14px 18px" }}
              >
                <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", marginBottom: "6px" }}>
                  Remind me in…
                </div>
                <div style={{ display: "flex", gap: "6px" }}>
                  {REMIND_OPTIONS.map((mins) => (
                    <button
                      key={mins}
                      onClick={(e) => { e.stopPropagation(); handleRemindConfirm(mins); }}
                      style={{
                        flex: 1,
                        padding: "6px 0",
                        borderRadius: "7px",
                        background: "rgba(167,139,250,0.1)",
                        color: "#a78bfa",
                        border: "1px solid rgba(167,139,250,0.2)",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(167,139,250,0.25)";
                        e.currentTarget.style.boxShadow = "0 0 10px rgba(167,139,250,0.25)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "rgba(167,139,250,0.1)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    >
                      {mins < 60 ? `${mins}m` : "1h"}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
