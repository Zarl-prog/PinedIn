import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calendar } from "lucide-react";
import { useReminderStore } from "@/store/reminderStore";
import type { Task } from "@/lib/tauriCommands";
import { cn } from "@/lib/utils";

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  editTask?: Task | null;
}

/**
 * AddTaskModal - Modal for creating or editing tasks.
 * Supports title, description, urgency, and optional due date.
 */
export default function AddTaskModal({
  open,
  onClose,
  editTask,
}: AddTaskModalProps) {
  const addTask = useReminderStore((s) => s.addTask);
  const editTaskAction = useReminderStore((s) => s.editTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "critical">(
    "medium",
  );
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description);
      setUrgency(editTask.urgency as "low" | "medium" | "critical");
      // due_time might be just a date string or empty
      if (editTask.due_time) {
        setDueDate(editTask.due_time);
      } else {
        setDueDate("");
      }
    } else {
      resetForm();
    }
  }, [editTask, open]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setUrgency("medium");
    setDueDate("");
    setError(null);
  };

  const handleSubmit = async () => {
    // Title is the only required field
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (editTask?.id) {
        await editTaskAction(
          editTask.id,
          title.trim(),
          description.trim(),
          urgency,
          dueDate || "",
        );
      } else {
        await addTask(
          title.trim(),
          description.trim(),
          urgency,
          dueDate || "",
        );
      }
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      resetForm();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-border/50 bg-card p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">
                {editTask ? "Edit Task" : "New Task"}
              </h2>
              <button
                onClick={handleClose}
                className="rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Title <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter task title..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  autoFocus
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description (optional)..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>

              {/* Urgency */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Urgency
                </label>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "low", label: "Low", color: "bg-urgency-low" },
                      {
                        value: "medium",
                        label: "Medium",
                        color: "bg-urgency-medium",
                      },
                      {
                        value: "critical",
                        label: "Critical",
                        color: "bg-urgency-critical",
                      },
                    ] as const
                  ).map((opt) => (
                    <motion.button
                      key={opt.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() =>
                        setUrgency(opt.value as "low" | "medium" | "critical")
                      }
                      className={cn(
                        "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
                        urgency === opt.value
                          ? `${opt.color}/15 border-${opt.value === "low" ? "urgency-low" : opt.value === "medium" ? "urgency-medium" : "urgency-critical"} text-foreground`
                          : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30",
                      )}
                    >
                      <span
                        className={cn(
                          "mx-auto mb-1 h-2 w-2 rounded-full",
                          opt.color,
                        )}
                      />
                      {opt.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Due Date - optional */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Due Date <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-10 py-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                  />
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground/50">
                  Set a deadline for this task
                </p>
              </div>

              {/* Error */}
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm text-destructive"
                >
                  {error}
                </motion.p>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {isSubmitting
                    ? "Saving..."
                    : editTask
                      ? "Save Changes"
                      : "Create Task"}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
