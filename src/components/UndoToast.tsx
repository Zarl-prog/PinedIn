import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReminderStore } from "@/store/reminderStore";
import { createTask, completeTask, uncompleteTask } from "@/lib/tauriCommands";

export default function UndoToast() {
  const undoEntry = useReminderStore((s) => s.undoEntry);
  const clearUndo = useReminderStore.getState().clearUndo;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (undoEntry) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => clearUndo(), 8000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [undoEntry, clearUndo]);

  async function handleUndo() {
    if (!undoEntry) return;
    clearUndo();
    const t = undoEntry.task;
    if (undoEntry.action === "delete") {
      await createTask(
        t.title,
        t.description,
        t.urgency,
        t.due_time,
        t.recurrence,
        t.tags,
        t.time_limit_minutes ?? null,
        t.workspace_id ?? null,
      );
    } else if (undoEntry.action === "complete") {
      await uncompleteTask(t.id!);
    }
  }

  return (
    <AnimatePresence>
      {undoEntry && (
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 40 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          style={{
            position: "fixed",
            bottom: "56px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "10px 16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            fontSize: "13px",
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          <span style={{ color: "var(--text-primary)" }}>
            {undoEntry.action === "delete"
              ? "Task deleted"
              : "Task completed"}
          </span>
          <button
            onClick={handleUndo}
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              border: "1px solid var(--border-hover)",
              borderRadius: "6px",
              padding: "4px 12px",
              background: "transparent",
              color: "var(--text-primary)",
            }}
          >
            Undo
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
