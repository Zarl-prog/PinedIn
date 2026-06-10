import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReminderStore } from "@/store/reminderStore";
import type { Task } from "@/lib/tauriCommands";

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  editTask?: Task | null;
  workspaceId?: number | null;
}

const RECURRENCE_OPTIONS = [
  { value: null, label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

const TIME_LIMIT_UNITS = [
  { value: "minutes", label: "minutes" },
  { value: "hours", label: "hours" },
] as const;

type TimeLimitUnit = (typeof TIME_LIMIT_UNITS)[number]["value"];

/**
 * AddTaskModal - Monochrome modal for creating or editing an *immediate* task.
 * Pre-schedule lives in its own dedicated PreScheduleModal — no toggle here.
 * All styling uses the exact palette from the spec: #0a0a0a, #1a1a1a, #ededed, etc.
 */
export default function AddTaskModal({
  open,
  onClose,
  editTask,
  workspaceId,
}: AddTaskModalProps) {
  const addTask = useReminderStore((s) => s.addTask);
  const editTaskAction = useReminderStore((s) => s.editTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<"low" | "medium" | "critical">(
    "medium",
  );
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [timeLimitValue, setTimeLimitValue] = useState("");
  const [timeLimitUnit, setTimeLimitUnit] = useState<TimeLimitUnit>("minutes");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description);
      setUrgency(editTask.urgency as "low" | "medium" | "critical");
      setDueDate(editTask.due_time || "");
      setRecurrence(editTask.recurrence ?? null);
      setTags(
        editTask.tags
          ? editTask.tags.split(",").map((t) => t.trim()).filter(Boolean)
          : [],
      );
      if (editTask.time_limit_minutes && editTask.time_limit_minutes > 0) {
        if (editTask.time_limit_minutes % 60 === 0) {
          setTimeLimitUnit("hours");
          setTimeLimitValue(String(editTask.time_limit_minutes / 60));
        } else {
          setTimeLimitUnit("minutes");
          setTimeLimitValue(String(editTask.time_limit_minutes));
        }
      } else {
        setTimeLimitUnit("minutes");
        setTimeLimitValue("");
      }
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTask?.id, open]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setUrgency("medium");
    setDueDate("");
    setRecurrence(null);
    setTags([]);
    setTagInput("");
    setTimeLimitValue("");
    setTimeLimitUnit("minutes");
    setError(null);
  };

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim().toLowerCase();
      if (trimmed && !tags.includes(trimmed) && tags.length < 5) {
        setTags((prev) => [...prev, trimmed]);
      }
      setTagInput("");
    },
    [tags],
  );

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        if (tagInput.trim()) {
          addTag(tagInput);
        }
      } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
        removeTag(tags[tags.length - 1]);
      }
    },
    [tagInput, tags, addTag, removeTag],
  );

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const tagsString = tags.length > 0 ? tags.join(",") : "";
      const timeLimitMinutes = timeLimitValue
        ? parseInt(timeLimitValue, 10) * (timeLimitUnit === "hours" ? 60 : 1)
        : null;
      const safeTimeLimit =
        timeLimitMinutes && timeLimitMinutes > 0 ? timeLimitMinutes : null;

      if (editTask?.id) {
        await editTaskAction(
          editTask.id,
          title.trim(),
          description.trim(),
          urgency,
          dueDate || "",
          recurrence,
          tagsString || null,
          safeTimeLimit,
        );
      } else {
        await addTask(
          title.trim(),
          description.trim(),
          urgency,
          dueDate || "",
          recurrence,
          tagsString,
          safeTimeLimit,
          workspaceId ?? null,
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
                {editTask ? "Edit Task" : "New Task"}
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
                ✕
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
                  Urgency
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  {(["low", "medium", "critical"] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setUrgency(opt)}
                      className={`pill-toggle${urgency === opt ? " selected" : ""}`}
                      style={{ flex: 1, textAlign: "center" }}
                    >
                      {opt === "critical" ? "Critical" : opt === "medium" ? "Medium" : "Low"}
                    </button>
                  ))}
                </div>
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
                  Due Date{" "}
                  <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <div style={{ position: "relative" }}>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      position: "absolute",
                      left: "10px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      pointerEvents: "none",
                    }}
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="input-field"
                    style={{ paddingLeft: "32px" }}
                  />
                </div>
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
                  Time Limit{" "}
                  <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                </label>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <input
                    type="number"
                    min="1"
                    placeholder="No limit"
                    value={timeLimitValue}
                    onChange={(e) => setTimeLimitValue(e.target.value)}
                    style={{
                      width: "100px",
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  />
                  <select
                    value={timeLimitUnit}
                    onChange={(e) => setTimeLimitUnit(e.target.value as TimeLimitUnit)}
                    style={{
                      background: "var(--bg-input)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                      padding: "8px 10px",
                      color: "var(--text-primary)",
                      fontSize: "12px",
                      fontFamily: "'Geist Mono', monospace",
                      cursor: "pointer",
                    }}
                  >
                    {TIME_LIMIT_UNITS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
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
                  Repeat
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  {RECURRENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setRecurrence(opt.value)}
                      className={`pill-toggle${recurrence === opt.value ? " selected" : ""}`}
                      style={{ flex: 1, textAlign: "center" }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
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
                  Tags{" "}
                  <span style={{ color: "var(--text-muted)" }}>(max 5)</span>
                </label>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "4px",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    minHeight: "42px",
                  }}
                >
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        background: "var(--bg-tag)",
                        border: "1px solid var(--border-light)",
                        borderRadius: "999px",
                        padding: "3px 10px",
                      }}
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "12px",
                            height: "12px",
                            borderRadius: "999px",
                            border: "none",
                            background: "transparent",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            fontSize: "11px",
                            padding: 0,
                          }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    ref={tagInputRef}
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder={tags.length < 5 ? "Add a tag..." : ""}
                    disabled={tags.length >= 5}
                    style={{
                      minWidth: "80px",
                      flex: 1,
                      border: "none",
                      background: "transparent",
                      color: "var(--text-primary)",
                      fontSize: "14px",
                      fontFamily: "'Geist Mono', monospace",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {error && (
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{error}</p>
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
                  {isSubmitting ? "Saving..." : editTask ? "Save" : "Add Task"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
