import { useState, useRef, useCallback, useMemo, useEffect } from "react";
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
  const contentRef = useRef<HTMLDivElement>(null);
  const mouseDownPos = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);

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

  const resizeToContent = useCallback(async () => {
    // Wait for DOM to settle after state change
    await new Promise((r) => setTimeout(r, 10));
    if (contentRef.current) {
      // Measure the v-float parent to include its border
      const el = contentRef.current.parentElement ?? contentRef.current;
      const height = el.getBoundingClientRect().height;
      await getCurrentWindow().setSize(new LogicalSize(280, Math.ceil(height)));
    }
  }, []);

  // Resize on mount, after expand/collapse, and after remind picker toggle
  useEffect(() => {
    resizeToContent();
  }, [expanded, showRemindPicker]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
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
    },
    [],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      if (dragging.current) return;
      const next = !expanded;
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

  const handleAction = useCallback(
    (action: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (action === "complete") handleDone();
      else if (action === "snooze") handleSnooze();
      else if (action === "remind") handleRemindClick(e);
    },
    [handleDone, handleSnooze, handleRemindClick],
  );

  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      className="v-float"
      style={{ marginBottom: 0 }}
    >
      <div ref={contentRef}>
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

        {/* Expanded: Action buttons */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.12 }}
              style={{ overflow: "hidden" }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  marginTop: "10px",
                  paddingTop: "10px",
                  borderTop: "1px solid #1a1a1a",
                }}
              >
                {/* Done */}
                <button
                  className="v-action"
                  onClick={(e) => handleAction("complete", e)}
                  style={{ flex: 1, textAlign: "center", fontSize: "11px", padding: "7px 10px" }}
                >
                  ✓ Done
                </button>
                {/* Snooze */}
                <button
                  className="v-action"
                  onClick={(e) => handleAction("snooze", e)}
                  style={{ flex: 1, textAlign: "center", fontSize: "11px", padding: "7px 10px" }}
                >
                  💤 Snooze
                </button>
                {/* Remind */}
                <button
                  className="v-action"
                  onClick={(e) => handleAction("remind", e)}
                  style={{ flex: 1, textAlign: "center", fontSize: "11px", padding: "7px 10px" }}
                >
                  🔔 Remind
                </button>
              </div>

              {/* Remind time picker */}
              {showRemindPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
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
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
