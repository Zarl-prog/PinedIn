import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion, useAnimation } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getShakeInterval } from "@/lib/tauriCommands";
import { useReminderStore } from "@/store/reminderStore";

interface TaskCardProps {
  taskId: number;
  title: string;
  description: string;
  urgency: string;
  dueTime: string;
  recurrence?: string | null;
  tags?: string | null;
}

const REMIND_OPTIONS = [5, 15, 30, 60] as const;

const URGENCY_LABEL: Record<string, string> = {
  critical: "Critical",
  medium: "Medium",
  low: "Low",
};

export default function TaskCard({
  taskId,
  title,
  description,
  urgency,
  dueTime,
  recurrence,
  tags,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showRemindPicker, setShowRemindPicker] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const interacting = useRef(false);
  const expandedRef = useRef(expanded);
  // Keep the ref in sync so interval closures always read the latest value
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

  // ─── Single animation control for both shake (x) and flash (boxShadow) ──
  const controls = useAnimation();

  const playAttention = useCallback(async () => {
    if (interacting.current) return;
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

  // Periodic attention-grabber — uses setting from DB, skip tick if expanded or paused
  useEffect(() => {
    const intervalMs = intervalSeconds * 1000;
    const interval = setInterval(() => {
      if (expandedRef.current) return;
      if (useReminderStore.getState().isPaused) return;
      playAttention();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [intervalSeconds, playAttention]);

  // First attention trigger — 3 seconds after mount (skipped if paused)
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

  // Progress bar: how close the due date is (0-100%)
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

  // Initial measurement and window sizing
  useEffect(() => {
    const measure = async () => {
      if (containerRef.current) {
        const h = containerRef.current.scrollHeight;
        await getCurrentWindow().setSize(new LogicalSize(280, Math.ceil(h)));
      }
    };
    measure();
  }, []);

  // Zero-flash resize logic: react to state changes and content mutations
  useEffect(() => {
    const measure = async () => {
      if (containerRef.current) {
        // Use scrollHeight to capture the full desired height even if clipped
        const h = containerRef.current.scrollHeight;
        await getCurrentWindow().setSize(new LogicalSize(280, Math.ceil(h)));
      }
    };

    // Immediate measure for the "1px start"
    measure();

    // Also observe mutations (like the buttons appearing) to re-measure
    const observer = new MutationObserver(measure);
    if (containerRef.current) {
      observer.observe(containerRef.current, { 
        childList: true, 
        subtree: true, 
        attributes: true 
      });
    }

    return () => observer.disconnect();
  }, [expanded, showRemindPicker]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      interacting.current = true;
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
        interacting.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [],
  );

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      if (dragging.current) return;
      
      const next = !expanded;
      
      // Step 1: immediately shrink window to near zero so no flash
      await getCurrentWindow().setSize(new LogicalSize(280, 1));
      
      // Step 2: update state
      setExpanded(next);
      setShowRemindPicker(false);
    },
    [expanded],
  );

  const handleDone = useCallback(async () => {
    await invoke("complete_task", { id: taskId });
    await getCurrentWindow().close();
  }, [taskId]);

  const handleSnooze = useCallback(async () => {
    await invoke("snooze_task", { id: taskId });
  }, [taskId]);

  const handleRemindClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      // Step 1: immediately shrink window
      await getCurrentWindow().setSize(new LogicalSize(280, 1));
      // Step 2: toggle
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

  const handleAction = useCallback(
    (action: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (action === "complete") handleDone();
      else if (action === "snooze") handleSnooze();
      else if (action === "remind") handleRemindClick(e);
      else if (action === "edit") {
        invoke("trigger_task_edit", { id: taskId });
      } else if (action === "delete") {
        invoke("delete_task", { id: taskId });
      }
    },
    [handleDone, handleSnooze, handleRemindClick, taskId],
  );

  return (
    <motion.div
      ref={containerRef}
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className="v-float"
      animate={controls}
      style={{ willChange: "transform, background-color" }}
    >
      {/* Summary content — always visible */}
      <div style={{ pointerEvents: "none" }}>
        {/* Title row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "#ededed",
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
                style={{ fontSize: "11px", color: "#444", flexShrink: 0 }}
              >
                ↻
              </span>
            )}
          </span>
          {/* Urgency badge */}
          <span className={`badge ${urgency === "critical" ? "critical" : urgency === "medium" ? "medium" : "low"}`}>
            {URGENCY_LABEL[urgency] ?? urgency}
          </span>
        </div>

        {/* Description */}
        {description && (
          <p
            style={{
              fontSize: "11px",
              color: "#444",
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

        {/* Tags */}
        {tagList.length > 0 && (
          <div style={{ display: "flex", gap: "4px", marginTop: "6px", flexWrap: "wrap" }}>
            {tagList.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "10px",
                  color: "#666",
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

        {/* Due date */}
        {dueTime && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginTop: "6px",
              fontSize: "11px",
              color: "#333",
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span>{dueTime}</span>
          </div>
        )}

        {/* Bottom progress bar */}
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

      {/* Expandable content — motion.div animates height, opacity and scale */}
      <motion.div
        ref={contentRef}
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
            flexDirection: "column",
            gap: "8px",
            paddingTop: "12px",
            borderTop: "1px solid #1a1a1a",
          }}
        >
          {/* Row 1: Primary Actions */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              className="v-action"
              onClick={(e) => handleAction("complete", e)}
              style={{ flex: 1, textAlign: "center", fontSize: "11px", padding: "8px 0" }}
            >
              ✓ Done
            </button>
            <button
              className="v-action"
              onClick={(e) => handleAction("snooze", e)}
              style={{ flex: 1, textAlign: "center", fontSize: "11px", padding: "8px 0" }}
            >
              💤 Snooze
            </button>
            <button
              className="v-action"
              onClick={(e) => handleAction("remind", e)}
              style={{ flex: 1, textAlign: "center", fontSize: "11px", padding: "8px 0" }}
            >
              🔔 Remind
            </button>
          </div>

          {/* Row 2: Management Actions */}
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              className="v-action"
              onClick={(e) => handleAction("edit", e)}
              style={{ flex: 1, textAlign: "center", fontSize: "11px", padding: "8px 0" }}
            >
              ✎ Edit
            </button>
            <button
              className="v-action"
              onClick={(e) => handleAction("delete", e)}
              style={{ 
                flex: 1, 
                textAlign: "center", 
                fontSize: "11px", 
                padding: "8px 0",
                color: "#ff4444",
                borderColor: "#331111"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#220000";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              🗑 Delete
            </button>
          </div>
        </div>

        {/* Remind time picker */}
        {showRemindPicker && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.1 }}
            style={{ marginTop: "8px" }}
          >
            <div style={{ fontSize: "11px", color: "#444", marginBottom: "6px" }}>
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
    </motion.div>
  );
}
