import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { Check, Bell, ClockCountdown, ArrowsClockwise, CaretDown } from "@phosphor-icons/react";

const REMIND_OPTIONS = [5, 15, 30, 60] as const;
const FIXED_HEIGHT = 115;

function getHoursAgo(createdAt: string): string {
  const diff = Date.now() - new Date(createdAt).getTime();
  const h = Math.floor(diff / 3600000);
  return h < 1 ? "< 1h" : `${h}h`;
}

function formatCardDate(dateStr: string): string {
  if (!dateStr) return "";
  const due = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = due.getTime() - today.getTime();
  if (diff === 0) return "Today";
  if (diff === 86400000) return "Tomorrow";
  if (diff === -86400000) return "Yesterday";
  const days = Math.round(diff / 86400000);
  if (days < -1) return `${Math.abs(days)}d overdue`;
  if (days > 1) return `In ${days}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TaskCard({
  taskId,
  title,
  description,
  dueTime,
  createdAt,
  recurrence,
  tags,
  timeLimitMinutes,
  startedAt,
}: {
  taskId: number;
  title: string;
  description: string;
  dueTime: string;
  createdAt: string;
  recurrence?: string | null;
  tags?: string | null;
  timeLimitMinutes?: number | null;
  startedAt?: string | null;
}) {
  const [showActions, setShowActions] = useState(false);
  const [showRemindPicker, setShowRemindPicker] = useState(false);
  const didDrag = useRef(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const liveDotRef = useRef<HTMLSpanElement>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    getCurrentWindow().setSize(new LogicalSize(308, FIXED_HEIGHT));
    invoke("reassert_window_properties");
  }, []);

  useEffect(() => {
    const dot = liveDotRef.current;
    if (!dot) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const alert = () => {
      dot.classList.remove("live");
      dot.classList.add("alert");
      timeout = setTimeout(() => {
        dot.classList.remove("alert");
        dot.classList.add("live");
        timeout = null;
      }, 60000);
    };
    const interval = setInterval(alert, 3600000);
    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, []);

  const tagList = tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];
  const hasRecurrence = !!recurrence;

  const progressPercent = useMemo(() => {
    if (!dueTime) return 0;
    const due = new Date(dueTime + "T23:59:59").getTime();
    const now = Date.now();
    const created = new Date(createdAt).getTime();
    const total = due - created;
    const elapsed = now - created;
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [dueTime, createdAt]);

  const [tlProgress, setTlProgress] = useState(100);
  const [tlColor, setTlColor] = useState("var(--card-progress-fill, var(--progress-fill-card))");
  const [tlFlash, setTlFlash] = useState(false);

  useEffect(() => {
    if (!timeLimitMinutes || !startedAt) return;
    const calc = () => {
      const total = timeLimitMinutes * 60000;
      const elapsed = Date.now() - new Date(startedAt).getTime();
      const remaining = Math.max(0, total - elapsed);
      const pct = (remaining / total) * 100;
      setTlProgress(pct);
      if (pct > 50) setTlColor("var(--card-progress-fill, var(--progress-fill-card))");
      else if (pct > 25) setTlColor("#f59e0b");
      else setTlColor("#ef4444");
      if (pct === 0 && !notifiedRef.current) {
        notifiedRef.current = true;
        invoke("notify", { title: "Time limit reached", body: `"${title}" time is up` });
      }
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [timeLimitMinutes, startedAt, taskId, title]);

  useEffect(() => {
    if (tlProgress > 0 && tlProgress <= 10) {
      const t = setInterval(() => setTlFlash((f) => !f), 500);
      return () => clearInterval(t);
    }
    setTlFlash(false);
  }, [tlProgress]);

  const finalBarColor = tlProgress <= 10 ? (tlFlash ? "#ef4444" : "#7f1d1d") : tlColor;
  const showTimeLimitBar = !!timeLimitMinutes && !!startedAt;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    didDrag.current = false;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    let dragInitiated = false;
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    const onMove = async (me: MouseEvent) => {
      const dx = Math.abs(me.clientX - mouseDownPos.current.x);
      const dy = Math.abs(me.clientY - mouseDownPos.current.y);
      if ((dx > 6 || dy > 6) && !dragInitiated) {
        dragInitiated = true;
        didDrag.current = true;
        try { await getCurrentWindow().startDragging(); }
        catch { didDrag.current = false; }
        finally { cleanup(); }
      }
    };
    const onUp = () => cleanup();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, []);

  const handleDone = useCallback(async () => {
    await invoke("complete_task", { id: taskId });
    await getCurrentWindow().close();
  }, [taskId]);

  const handleSnooze = useCallback(async () => {
    await invoke("snooze_task", { id: taskId });
  }, [taskId]);

  const handleRemindConfirm = useCallback(async (minutes: number) => {
    await invoke("remind_task", { id: taskId, minutes });
  }, [taskId]);

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        background: "var(--card-bg, #0f0f11)",
        border: "1px solid var(--card-border, rgba(255,255,255,0.08))",
        borderRadius: "12px",
        width: "280px",
        height: showTimeLimitBar ? `${FIXED_HEIGHT + 4}px` : `${FIXED_HEIGHT}px`,
        overflow: "hidden",
        cursor: "grab",
        userSelect: "none",
        position: "relative",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{
        position: "absolute",
        left: 0, top: 0, bottom: 0,
        width: "3px",
        background: "var(--left-accent, transparent)",
        borderRadius: "3px 0 0 3px",
      }} />

      <button
        onClick={(e) => { e.stopPropagation(); setShowActions((p) => !p); setShowRemindPicker(false); }}
        title={showActions ? "Show task info" : "Show actions"}
        style={{
          position: "absolute",
          right: "8px",
          bottom: "8px",
          zIndex: 1,
          width: "22px",
          height: "22px",
          borderRadius: "6px",
          border: "1px solid var(--border-card-light, rgba(255,255,255,0.1))",
          background: "var(--card-bg, #0f0f11)",
          color: "var(--text-dim-card)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.6,
          transition: "opacity 0.15s ease",
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
        onMouseLeave={(e) => e.currentTarget.style.opacity = "0.6"}
      >
        <CaretDown size={12} weight="bold" style={{
          transform: showActions ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
        }} />
      </button>

      {showActions ? (
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "12px 14px",
        }}>
          <div style={{ display: "flex", gap: "6px" }}>
            <button className="v-action" onClick={(e) => { e.stopPropagation(); handleDone(); }}
              style={{ flex: 1, fontSize: "11px", padding: "8px 0", background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", borderRadius: "8px", cursor: "pointer", textAlign: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center" }}><Check size={14} weight="light" /> Done</span>
            </button>
            <button className="v-action" onClick={(e) => { e.stopPropagation(); handleSnooze(); }}
              style={{ flex: 1, fontSize: "11px", padding: "8px 0", background: "rgba(234,179,8,0.08)", color: "#eab308", border: "1px solid rgba(234,179,8,0.25)", borderRadius: "8px", cursor: "pointer", textAlign: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center" }}><ClockCountdown size={14} weight="light" /> Snooze</span>
            </button>
            <button className="v-action" onClick={(e) => { e.stopPropagation(); setShowRemindPicker((p) => !p); }}
              style={{ flex: 1, fontSize: "11px", padding: "8px 0", background: "rgba(139,92,246,0.08)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.25)", borderRadius: "8px", cursor: "pointer", textAlign: "center" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center" }}><Bell size={14} weight="light" /> Remind</span>
            </button>
          </div>

          {showRemindPicker && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.1 }}
              style={{ marginTop: "8px" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                {REMIND_OPTIONS.map((mins) => (
                  <button key={mins} onClick={(e) => { e.stopPropagation(); handleRemindConfirm(mins); }}
                    className="v-action"
                    style={{ flex: 1, fontSize: "11px", padding: "7px 10px", cursor: "pointer" }}>
                    {mins < 60 ? `${mins}m` : "1h"}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      ) : (
        <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span style={{
              fontSize: "13px", fontWeight: 500, color: "var(--text-primary-card)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              flex: 1, marginRight: "8px", display: "flex", alignItems: "center", gap: "4px",
            }}>
              {title}
              {hasRecurrence && (
                <span title={`Repeats ${recurrence}`} style={{ fontSize: "11px", color: "var(--text-dim-card)", flexShrink: 0 }}>
                  <ArrowsClockwise size={12} weight="light" />
                </span>
              )}
            </span>
            <span ref={liveDotRef} className="dot live" aria-label="Task heartbeat" />
          </div>

          {description && (
            <p style={{ fontSize: "11px", color: "var(--text-dim-card)", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
              {description}
            </p>
          )}

          {tagList.length > 0 && (
            <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
              {tagList.map((tag) => (
                <span key={tag} style={{ fontSize: "10px", color: "var(--text-dim-card)", background: "var(--bg-tag-card)", border: "1px solid var(--border-card-tag)", borderRadius: "999px", padding: "2px 7px" }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div style={{ marginTop: "auto" }}>
            {dueTime && (
              <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--text-dim-card)" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim-card)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>{formatCardDate(dueTime)}</span>
              </div>
            )}

            {createdAt && (
              <div style={{ fontSize: "10px", color: "var(--text-faint-card)", fontFamily: "'Geist Mono', monospace" }}>
                {getHoursAgo(createdAt)}
              </div>
            )}

            <div style={{ width: "100%", height: "1px", background: "var(--card-progress-track, var(--progress-track-card))", marginTop: "6px", borderRadius: "2px", overflow: "hidden" }}>
              <div style={{ width: `${progressPercent}%`, height: "100%", background: "var(--card-progress-fill, var(--progress-fill-card))", transition: "width 0.4s ease", borderRadius: "2px" }} />
            </div>
          </div>
        </div>
      )}

      {showTimeLimitBar && (
        <div style={{ width: "100%", height: "4px", background: "var(--card-border, var(--border-card))", borderRadius: "0 0 14px 14px", overflow: "hidden" }}>
          <motion.div
            animate={{ width: `${tlProgress}%`, backgroundColor: finalBarColor }}
            transition={{ duration: 0.8, ease: "linear" }}
            style={{ height: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
