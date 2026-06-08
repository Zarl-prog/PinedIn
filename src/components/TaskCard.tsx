import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  getShakeInterval,
  fireTimeLimitNotification,
} from "@/lib/tauriCommands";
import { useReminderStore } from "@/store/reminderStore";
import UrgencyBadge from "./UrgencyBadge";

interface TaskCardProps {
  taskId: number;
  title: string;
  description: string;
  urgency: string;
  dueTime: string;
  createdAt: string;
  recurrence?: string | null;
  tags?: string | null;
  timeLimitMinutes?: number | null;
  startedAt?: string | null;
}

const REMIND_OPTIONS = [5, 15, 30, 60] as const;

const COLLAPSED_HEIGHT = 120;
const EXPANDED_HEIGHT = 180;

const URGENCY_LABEL: Record<string, string> = {
  critical: "Critical",
  medium: "Medium",
  low: "Low",
};

function getHoursAgo(createdAt: string): string {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  const diffMs = now - created;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return "< 1h";
  return `${diffHours}h`;
}

function formatCardDate(dateStr: string): string {
  if (!dateStr) return "";
  const due = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = due.getTime() - today.getTime();
  if (diffTime === 0) return "Today";
  if (diffTime === 86400000) return "Tomorrow";
  if (diffTime === -86400000) return "Yesterday";
  const diffDays = Math.round(diffTime / 86400000);
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays > 1) return `In ${diffDays}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function TaskCard({
  taskId,
  title,
  description,
  urgency,
  dueTime,
  createdAt,
  recurrence,
  tags,
  timeLimitMinutes,
  startedAt,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRemindPicker, setShowRemindPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const liveDotRef = useRef<HTMLSpanElement>(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  // ─── Shake interval — loaded from DB, updated live via event ────────────
  const [intervalSeconds, setIntervalSeconds] = useState(30);

  useEffect(() => {
    getShakeInterval()
      .then((s) => setIntervalSeconds(s))
      .catch(() => {});
    const unlisten = listen<number>("shake_interval_updated", (e) => {
      setIntervalSeconds(e.payload);
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const controls = useAnimation();

  const playAttention = useCallback(async () => {
    const amplitude = urgency === "critical" ? [-12, 12, -10, 10, -6, 6] : [-8, 8, -6, 6, -4, 4];
    await controls.start({
      x: [0, ...amplitude, 0],
      boxShadow: [
        "0 0 0px rgba(255,255,255,0)",
        "0 0 20px rgba(255,255,255,0.4)",
        "0 0 10px rgba(255,255,255,0.2)",
        "0 0 0px rgba(255,255,255,0)",
      ],
      backgroundColor: ["#080808", "#121212", "#0a0a0a", "#080808"],
      transition: {
        x: { duration: 0.4, ease: "easeInOut" },
        boxShadow: { duration: 0.6, ease: "easeInOut" },
        backgroundColor: { duration: 0.6, ease: "easeInOut" },
      },
    });
  }, [urgency, controls]);

  useEffect(() => {
    const intervalMs = intervalSeconds * 1000;
    const interval = setInterval(() => {
      if (expandedRef.current) return;
      if (useReminderStore.getState().isPaused) return;
      playAttention();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalSeconds, playAttention]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (useReminderStore.getState().isPaused) return;
      playAttention();
    }, 3000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const hasRecurrence = !!recurrence;
  const tagList = tags
    ? tags.split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  const progressPercent = useMemo(() => {
    if (!dueTime) return 0;
    const due = new Date(dueTime + "T23:59:59").getTime();
    const now = Date.now();
    const created = now - 7 * 24 * 60 * 60 * 1000;
    const total = due - created;
    const elapsed = now - created;
    if (total <= 0) return 100;
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [dueTime]);

  const [progress, setProgress] = useState(100);
  const [barColor, setBarColor] = useState("#ffffff");
  const [flash, setFlash] = useState(false);
  const notifiedRef = useRef(false);

  useEffect(() => {
    if (!timeLimitMinutes || !startedAt) return;

    function calculate() {
      const totalMs = timeLimitMinutes! * 60 * 1000;
      const startedAtMs = new Date(startedAt!).getTime();
      const now = Date.now();
      const elapsed = now - startedAtMs;
      const remaining = Math.max(0, totalMs - elapsed);
      const pct = (remaining / totalMs) * 100;

      setProgress(pct);

      if (pct > 50) setBarColor("#ffffff");
      else if (pct > 25) setBarColor("#f59e0b");
      else setBarColor("#ef4444");

      if (pct === 0 && !notifiedRef.current) {
        notifiedRef.current = true;
        fireTimeLimitNotification(taskId, title).catch(() => {});
      }
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [timeLimitMinutes, startedAt, taskId, title]);

  useEffect(() => {
    if (progress <= 10 && progress > 0) {
      const t = setInterval(() => setFlash((f) => !f), 500);
      return () => clearInterval(t);
    }
    setFlash(false);
  }, [progress]);

  const finalBarColor = progress <= 10 ? (flash ? "#ef4444" : "#7f1d1d") : barColor;
  const showTimeLimitBar = !!timeLimitMinutes && !!startedAt;

  useEffect(() => {
    getCurrentWindow().setSize(new LogicalSize(280, COLLAPSED_HEIGHT));
  }, []);

  useEffect(() => {
    const dot = liveDotRef.current;
    if (!dot) return;

    let alertTimeout: ReturnType<typeof setTimeout> | null = null;

    const startAlert = () => {
      dot.classList.remove("live");
      dot.classList.add("alert");
      alertTimeout = setTimeout(() => {
        dot.classList.remove("alert");
        dot.classList.add("live");
        alertTimeout = null;
      }, 60_000);
    };

    const interval = setInterval(startAlert, 60 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (alertTimeout) clearTimeout(alertTimeout);
    };
  }, []);

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    await getCurrentWindow().startDragging();
  }, []);

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const next = !expanded;
    setExpanded(next);
    setShowRemindPicker(false);
  }, [expanded]);

  const handleDone = useCallback(async () => {
    await invoke("complete_task", { id: taskId });
    await getCurrentWindow().close();
  }, [taskId]);

  const handleSnooze = useCallback(async () => {
    await invoke("snooze_task", { id: taskId });
  }, [taskId]);

  const handleRemindClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setShowRemindPicker((prev) => !prev);
    },
    [],
  );

  const handleRemindConfirm = useCallback(
    async (minutes: number) => {
      await invoke("remind_task", { id: taskId, minutes });
    },
    [taskId],
  );

  return (
    <motion.div
      ref={containerRef}
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className="v-float"
      animate={controls}
      style={{
        position: "relative",
        overflow: "hidden",
        padding: 0,
        willChange: "transform, background-color",
      }}
    >
      <div style={{ padding: "12px 14px", pointerEvents: "none" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#ffffff",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              marginRight: "8px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            {title}
            {hasRecurrence && (
              <span
                title={`Repeats ${recurrence}`}
                style={{ fontSize: "11px", color: "#888888", flexShrink: 0 }}
              >
                ↻
              </span>
            )}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
            <span
              ref={liveDotRef}
              className="dot live"
              aria-label="Task heartbeat"
              title="Task heartbeat — blinks red once an hour"
            />
            <UrgencyBadge urgency={(urgency as "low" | "medium" | "critical")} />
          </div>
        </div>

        {description && (
          <p
            style={{
              fontSize: "11px",
              color: "#888888",
              marginTop: "4px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "160px",
            }}
          >
            {description}
          </p>
        )}

        {tagList.length > 0 && (
          <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
            {tagList.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "10px",
                  color: "#888888",
                  background: "#0d0d0d",
                  border: "1px solid #1e1e1e",
                  borderRadius: "999px",
                  padding: "2px 7px",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {dueTime && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginTop: "6px",
              fontSize: "11px",
              color: "#888888",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#888888" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{formatCardDate(dueTime)}</span>
          </div>
        )}

        {createdAt && (
          <div style={{
            fontSize: "10px",
            color: "rgba(255,255,255,0.2)",
            marginTop: "2px",
            fontFamily: "'Geist Mono', monospace"
          }}>
            {getHoursAgo(createdAt)}
          </div>
        )}

        <div
          style={{
            width: "100%",
            height: "1px",
            background: "#111",
            marginTop: "8px",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: "100%",
              background: "#fff",
              transition: "width 0.4s ease",
              borderRadius: "2px",
            }}
          />
        </div>
      </div>

      <motion.div
        initial={false}
        animate={{
          height: expanded ? "auto" : 0,
          opacity: expanded ? 1 : 0,
          scale: expanded ? 1 : 0.98,
          marginTop: expanded ? 12 : 0
        }}
        transition={{
          height: { type: "spring", stiffness: 350, damping: 35 },
          opacity: { duration: 0.15 },
          scale: { duration: 0.15 }
        }}
        style={{ overflow: "hidden", transformOrigin: "top" }}
      >
        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "0 14px 14px",
          }}
        >
          <button
            className="v-action"
            onClick={(e) => { e.stopPropagation(); handleDone(); }}
            style={{ flex: 1, textAlign: "center", fontSize: "11px", padding: "8px 0" }}
          >
            ✓ Done
          </button>
          <button
            className="v-action"
            onClick={(e) => { e.stopPropagation(); handleSnooze(); }}
            style={{ flex: 1, textAlign: "center", fontSize: "11px", padding: "8px 0" }}
          >
            💤 Snooze
          </button>
          <button
            className="v-action"
            onClick={(e) => { e.stopPropagation(); handleRemindClick(e); }}
            style={{ flex: 1, textAlign: "center", fontSize: "11px", padding: "8px 0" }}
          >
            🔔 Remind
          </button>
        </div>

        {showRemindPicker && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.1 }}
            style={{ marginTop: "4px", padding: "0 14px 14px" }}
          >
            <div style={{ fontSize: "11px", color: "#888888", marginBottom: "6px" }}>
              Remind me in…
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {REMIND_OPTIONS.map((mins) => (
                <button
                  key={mins}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemindConfirm(mins);
                  }}
                  className="v-action"
                  style={{
                    flex: 1,
                    textAlign: "center",
                    fontSize: "11px",
                    padding: "7px 10px",
                  }}
                >
                  {mins < 60 ? `${mins}m` : "1h"}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </motion.div>

      {showTimeLimitBar && (
        <div
          style={{
            width: "100%",
            height: "4px",
            background: "#1a1a1a",
          }}
        >
          <motion.div
            animate={{
              width: `${progress}%`,
              backgroundColor: finalBarColor,
            }}
            transition={{ duration: 0.8, ease: "linear" }}
            style={{ height: "100%" }}
          />
        </div>
      )}
    </motion.div>
  );
}
