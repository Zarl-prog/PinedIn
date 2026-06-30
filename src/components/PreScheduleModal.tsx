import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReminderStore } from "@/store/reminderStore";
import { localDateStr, localIsoString } from "@/lib/utils";
import { X } from "@phosphor-icons/react";

interface PreScheduleModalProps {
  open: boolean;
  onClose: () => void;
  workspaceId?: number | null;
}

/**
 * PreScheduleModal - Dedicated modal for scheduling a task to appear in
 * the future. No mode toggle, no confusion — this is *only* for
 * scheduling, with a clean set of fields: title, description, urgency,
 * scheduled date, scheduled time, and a Schedule button.
 */
export default function PreScheduleModal({ open, onClose, workspaceId }: PreScheduleModalProps) {
  const addPrescheduledTask = useReminderStore.getState().addPrescheduledTask;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to "one hour from now, rounded down to the next 5 minutes"
  useEffect(() => {
    if (!open) return;
    if (scheduledDate && scheduledTime) return;
    const d = new Date();
    d.setHours(d.getHours() + 1);
    const minutes = d.getMinutes();
    d.setMinutes(minutes - (minutes % 5), 0, 0);
    setScheduledDate(localDateStr(d));
    setScheduledTime(
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
    );
    // scheduledDate / scheduledTime are read as a "have we already
    // prefilled" sentinel — not as live inputs. The reset on close
    // makes that safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setScheduledDate("");
    setScheduledTime("");
    setError(null);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      resetForm();
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      setError("Pick a date and time to schedule for");
      return;
    }
    const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
    if (isNaN(scheduledAt.getTime())) {
      setError("Invalid date or time");
      return;
    }
    if (scheduledAt.getTime() <= Date.now()) {
      setError("Scheduled time must be in the future");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await addPrescheduledTask(
        title.trim(),
        description.trim(),
        localIsoString(scheduledAt),
        scheduledDate,
        null,
        null,
        workspaceId ?? null,
      );
      onClose();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayStr = localDateStr();

  return (
    <AnimatePresence>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--bg-overlay)",
            }}
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: "420px",
              background: "var(--bg-modal)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <span style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-primary)" }}>
                Pre-Schedule Task
              </span>
              <button
                onClick={handleClose}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-light)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "15px",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-badge)";
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.borderColor = "var(--text-muted)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.borderColor = "var(--border-light)";
                }}
              >
                <X size={16} weight="light" />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  Title <span style={{ color: "var(--text-muted)" }}>*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter task title..."
                  className="input-field"
                  autoFocus
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description (optional)..."
                  rows={3}
                  className="input-field"
                  style={{ resize: "none", lineHeight: 1.5 }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    marginBottom: "6px",
                  }}
                >
                  Schedule For <span style={{ color: "var(--text-muted)" }}>*</span>
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="date"
                    value={scheduledDate}
                    min={todayStr}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="input-field"
                    style={{ flex: 1 }}
                  />
                  <input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="input-field"
                    style={{ flex: 1 }}
                  />
                </div>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-muted)",
                    marginTop: "6px",
                  }}
                >
                  Task will appear in your task list at the scheduled time.
                </p>
              </div>

              {error && (
                <p style={{ fontSize: "13px", color: "var(--text-danger)", fontWeight: 500 }}>{error}</p>
              )}

              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="feature-btn"
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: "8px",
                    fontSize: "14px",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="feature-btn primary"
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: "8px",
                    fontSize: "14px",
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                >
                  {isSubmitting ? "Scheduling..." : "Schedule"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
