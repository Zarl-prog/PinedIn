import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ListTodo, GripHorizontal, Pin } from "lucide-react";
import { getIncompleteTasks, completeTask, saveOverlayPosition } from "@/lib/tauriCommands";
import UrgencyBadge from "./UrgencyBadge";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

/**
 * OverlayPanel - Compact always-on-top floating panel showing incomplete tasks.
 * Uses Tauri's native drag region for window repositioning.
 * Frosted glass dark theme with OS-level transparency.
 * Saves and restores position across sessions.
 */
export default function OverlayPanel() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const windowApi = useRef(getCurrentWindow());

  const fetchTasks = useCallback(async () => {
    try {
      const result = await getIncompleteTasks();
      setTasks(result);
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();

    let unlisten: (() => void) | undefined;
    async function setup() {
      const fn = await listen("tasks-updated", () => {
        fetchTasks();
      });
      unlisten = fn;
    }
    setup();

    // Apply transparent background to html/body for this window
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";

    return () => {
      if (unlisten) unlisten();
    };
  }, [fetchTasks]);

  const handleComplete = async (id: number) => {
    try {
      await completeTask(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error("Failed to complete task:", e);
    }
  };

  // Save current window position after Tauri native drag ends
  const savePosition = useCallback(async () => {
    try {
      const win = windowApi.current;
      const pos = await win.outerPosition();
      await saveOverlayPosition(pos.x, pos.y);
    } catch (e) {
      // Silently fail - position saving is non-critical
    }
  }, []);

  const incompleteCount = tasks.length;
  const isAllClear = incompleteCount === 0 && !loading;

  // All clear - show minimal pill
  if (isAllClear) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 right-4 z-[9999]"
      >
        <div className="flex cursor-default items-center gap-2 rounded-full px-4 py-2 shadow-lg"
          style={{
            background: "rgba(15, 15, 18, 0.55)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>All clear</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className="fixed bottom-4 right-4 z-[9999] w-[320px] overflow-hidden"
      style={{
        borderRadius: "16px",
        background: "rgba(15, 15, 18, 0.55)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* Header with Tauri native drag region */}
      {/* onMouseUp fires after OS-level drag ends, letting us save position */}
      <div
        data-tauri-drag-region
        onMouseUp={savePosition}
        className="flex cursor-grab items-center justify-between px-3 py-2.5 active:cursor-grabbing"
        style={{
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          userSelect: "none",
        }}
      >
        <div className="flex items-center gap-2" data-tauri-drag-region>
          <Pin className="h-3.5 w-3.5" style={{ color: "rgba(139, 127, 255, 0.9)" }} />
          <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>Active Tasks</span>
          <span
            className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold"
            style={{ background: "rgba(139, 127, 255, 0.2)", color: "rgba(139, 127, 255, 0.9)" }}
          >
            {incompleteCount}
          </span>
        </div>
        <GripHorizontal className="h-3.5 w-3.5" style={{ color: "rgba(255,255,255,0.25)" }} />
      </div>

      {/* Task list */}
      <div className="max-h-[360px] overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}>
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <ListTodo className="mb-2 h-8 w-8" style={{ color: "rgba(255,255,255,0.15)" }} />
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>No active tasks</p>
          </div>
        ) : (
          <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.04)" }}>
            {tasks.map((task, index) => (
              <OverlayTaskItem
                key={task.id ?? index}
                task={task}
                onComplete={() => handleComplete(task.id!)}
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Overlay Task Item ───────────────────────────────────────────────────────

interface OverlayTaskItemProps {
  task: any;
  onComplete: () => void;
}

function OverlayTaskItem({ task, onComplete }: OverlayTaskItemProps) {
  const urgency = task.urgency as "low" | "medium" | "critical";

  return (
    <div
      className="group flex items-start gap-2.5 px-3 py-2.5 transition-colors"
      style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.04)" }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      {/* Complete button */}
      <button
        onClick={onComplete}
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors"
        style={{
          border: "1px solid rgba(255,255,255,0.2)",
          background: "transparent",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.border = "1px solid rgba(139, 127, 255, 0.5)";
          e.currentTarget.style.background = "rgba(139, 127, 255, 0.1)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.border = "1px solid rgba(255,255,255,0.2)";
          e.currentTarget.style.background = "transparent";
        }}
      >
        <CheckCircle2 className="h-3 w-3" style={{ color: "transparent" }} />
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-xs font-medium" style={{ color: "rgba(255,255,255,0.85)" }}>
            {task.title}
          </p>
          <UrgencyBadge urgency={urgency} className="shrink-0 scale-[0.7] origin-right" />
        </div>
        {task.due_time && (
          <p className="mt-0.5 text-[10px]" style={{ color: "rgba(255,255,255,0.4)" }}>
            Due {formatOverlayDate(task.due_time)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatOverlayDate(dateStr: string): string {
  if (!dateStr) return "";
  const due = new Date(dateStr + "T00:00:00");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (due.getTime() === today.getTime()) return "Today";
  if (due.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (due.getTime() === yesterday.getTime()) return "Yesterday";

  return due.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
