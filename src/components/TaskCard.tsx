import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";

const COLLAPSED_HEIGHT = 120;
const EXPANDED_HEIGHT = 180;

export default function TaskCard({
  taskId,
  title,
  description,
  dueTime,
  createdAt,
  recurrence,
  tags,
}: {
  taskId: number;
  title: string;
  description: string;
  dueTime: string;
  createdAt: string;
  recurrence?: string | null;
  tags?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const didDrag = useRef(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    getCurrentWindow().setSize(new LogicalSize(308, COLLAPSED_HEIGHT));
    invoke("reassert_window_properties");
  }, []);

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

  const handleDoubleClick = useCallback(async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (didDrag.current) return;
    const next = !expanded;
    setExpanded(next);
    await getCurrentWindow().setSize(new LogicalSize(308, next ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT));
  }, [expanded]);

  const handleDone = useCallback(async () => {
    await invoke("complete_task", { id: taskId });
    await getCurrentWindow().close();
  }, [taskId]);

  const handleSnooze = useCallback(async () => {
    await invoke("snooze_task", { id: taskId });
  }, [taskId]);

  const handleRemind = useCallback(async () => {
    await invoke("remind_task", { id: taskId, minutes: 15 });
  }, [taskId]);

  const tagList = tags?.split(",").map((t) => t.trim()).filter(Boolean) ?? [];

  return (
    <motion.div
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      animate={{ height: expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{
        background: "var(--card-bg, #0f0f11)",
        border: "1px solid var(--card-border, rgba(255,255,255,0.08))",
        borderRadius: "12px",
        width: "280px",
        overflow: "hidden",
        cursor: "grab",
        userSelect: "none",
      }}
    >
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary-card)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {title}
        </div>
        {description && (
          <p style={{ fontSize: "11px", color: "var(--text-dim-card)", marginTop: "4px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
      </div>

      {expanded && (
        <div style={{ padding: "0 14px 14px", display: "flex", gap: "6px" }}>
          <button className="v-action" onClick={(e) => { e.stopPropagation(); handleDone(); }}
            style={{ flex: 1, fontSize: "11px", padding: "8px 0", background: "var(--btn-done-bg)", color: "var(--btn-done-text)", border: "1px solid var(--btn-done-border)", borderRadius: "8px", cursor: "pointer", textAlign: "center" }}>
            Done
          </button>
          <button className="v-action" onClick={(e) => { e.stopPropagation(); handleSnooze(); }}
            style={{ flex: 1, fontSize: "11px", padding: "8px 0", background: "var(--btn-snooze-bg)", color: "var(--btn-snooze-text)", border: "1px solid var(--btn-snooze-border, var(--border-light))", borderRadius: "8px", cursor: "pointer", textAlign: "center" }}>
            Snooze
          </button>
          <button className="v-action" onClick={(e) => { e.stopPropagation(); handleRemind(); }}
            style={{ flex: 1, fontSize: "11px", padding: "8px 0", background: "var(--btn-remind-bg)", color: "var(--btn-remind-text)", border: "1px solid var(--btn-remind-border, var(--border-light))", borderRadius: "8px", cursor: "pointer", textAlign: "center" }}>
            Remind
          </button>
        </div>
      )}
    </motion.div>
  );
}
