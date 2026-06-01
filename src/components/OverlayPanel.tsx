import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, ListTodo, GripHorizontal, Pin, ExternalLink } from "lucide-react";
import { useReminderStore } from "@/store/reminderStore";
import UrgencyBadge from "./UrgencyBadge";
import { completeTask } from "@/lib/tauriCommands";
import { listen } from "@tauri-apps/api/event";
import { cn } from "@/lib/utils";

/**
 * OverlayPanel - Compact always-on-top floating panel showing incomplete tasks.
 * Anchored to bottom-right of screen, always visible when tasks exist.
 * Collapses to a minimal "All clear" pill when all tasks are completed.
 * Content updates live via Tauri events from the backend.
 */
export default function OverlayPanel() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchTasks = useCallback(async () => {
    try {
      const { getIncompleteTasks } = await import("@/lib/tauriCommands");
      const result = await getIncompleteTasks();
      setTasks(result);
      setLoading(false);
    } catch (e) {
      console.error("Failed to fetch tasks:", e);
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

    return () => {
      if (unlisten) unlisten();
    };
  }, [fetchTasks]);

  const handleComplete = async (id: number) => {
    try {
      await completeTask(id);
      // The tasks-updated event will re-fetch, so optimistic update is fine
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      console.error("Failed to complete task:", e);
    }
  };

  const incompleteCount = tasks.length;
  const isAllClear = incompleteCount === 0 && !loading;

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: rect.left,
      posY: rect.top,
    };
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const newX = dragRef.current.posX + dx;
      const newY = dragRef.current.posY + dy;

      if (panelRef.current) {
        panelRef.current.style.left = `${newX}px`;
        panelRef.current.style.top = `${newY}px`;
        panelRef.current.style.right = "auto";
        panelRef.current.style.bottom = "auto";
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  // All clear - show minimal pill
  if (isAllClear) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 right-4 z-[9999]"
      >
        <div className="flex cursor-default items-center gap-2 rounded-full border border-border/50 bg-card/80 px-4 py-2 shadow-lg backdrop-blur-md">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-xs font-medium text-muted-foreground">All clear</span>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      className={cn(
        "fixed bottom-4 right-4 z-[9999] w-[320px] overflow-hidden rounded-xl border",
        "border-border/50 bg-card/95 shadow-2xl backdrop-blur-xl",
        dragging && "shadow-2xl",
      )}
      style={{ userSelect: dragging ? "none" : undefined }}
    >
      {/* Header with drag handle */}
      <div
        className="flex cursor-grab items-center justify-between border-b border-border/30 px-3 py-2.5 active:cursor-grabbing"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Pin className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Active Tasks</span>
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary/20 px-1 text-[10px] font-bold text-primary">
            {incompleteCount}
          </span>
        </div>
        <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/40" />
      </div>

      {/* Task list */}
      <div className="max-h-[360px] overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <ListTodo className="mb-2 h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/50">No active tasks</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
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

      {/* Subtle resize handle hint */}
      <div className="flex items-center justify-center border-t border-border/20 py-1">
        <div className="h-1 w-8 rounded-full bg-muted-foreground/20" />
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
    <div className="group flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/30">
      {/* Complete button */}
      <button
        onClick={onComplete}
        className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30 transition-colors hover:border-primary/50 hover:bg-primary/10"
      >
        <CheckCircle2 className="h-3 w-3 text-transparent group-hover:text-primary/50" />
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-xs font-medium text-foreground">
            {task.title}
          </p>
          <UrgencyBadge urgency={urgency} className="shrink-0 scale-[0.7] origin-right" />
        </div>
        {task.due_time && (
          <p className="mt-0.5 text-[10px] text-muted-foreground/60">
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
