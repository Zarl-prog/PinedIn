import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReminderStore } from "@/store/reminderStore";
import type { Task } from "@/lib/tauriCommands";

interface AddTaskModalProps {
  open: boolean;
  onClose: () => void;
  editTask?: Task | null;
}

const RECURRENCE_OPTIONS = [
  { value: null, label: "None" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

/**
 * AddTaskModal - Monochrome modal for creating or editing tasks.
 * All styling uses the exact palette from the spec: #0a0a0a, #1a1a1a, #ededed, etc.
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
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  // Populate form when editing
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
    } else {
      resetForm();
    }
  }, [editTask, open]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setUrgency("medium");
    setDueDate("");
    setRecurrence(null);
    setTags([]);
    setTagInput("");
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

    const tagsString = tags.length > 0 ? tags.join(",") : "";

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
          recurrence,
          tagsString,
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
            }}
            onClick={handleClose}
          />

          {/* Modal */}
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
              background: "#0a0a0a",
              border: "1px solid #1a1a1a",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#ededed" }}>
                {editTask ? "Edit Task" : "New Task"}
              </span>
              <button
                onClick={handleClose}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  border: "1px solid #222",
                  background: "transparent",
                  color: "#666",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#111";
                  e.currentTarget.style.color = "#fff";
                  e.currentTarget.style.borderColor = "#444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#666";
                  e.currentTarget.style.borderColor = "#222";
                }}
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Title */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#888",
                    marginBottom: "5px",
                  }}
                >
                  Title <span style={{ color: "#444" }}>*</span>
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

              {/* Description */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#888",
                    marginBottom: "5px",
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

              {/* Urgency */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#888",
                    marginBottom: "5px",
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

              {/* Due Date */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#888",
                    marginBottom: "5px",
                  }}
                >
                  Due Date{" "}
                  <span style={{ color: "#444" }}>(optional)</span>
                </label>
                <div style={{ position: "relative" }}>
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#444"
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

              {/* Repeat / Recurrence */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#888",
                    marginBottom: "5px",
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

              {/* Tags */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "11px",
                    fontWeight: 500,
                    color: "#888",
                    marginBottom: "5px",
                  }}
                >
                  Tags{" "}
                  <span style={{ color: "#444" }}>(max 5)</span>
                </label>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: "4px",
                    background: "#0a0a0a",
                    border: "1px solid #1a1a1a",
                    borderRadius: "6px",
                    padding: "8px 10px",
                    minHeight: "38px",
                  }}
                >
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        fontSize: "10px",
                        color: "#666",
                        background: "#111",
                        border: "1px solid #222",
                        borderRadius: "999px",
                        padding: "2px 8px",
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
                          color: "#444",
                          cursor: "pointer",
                          fontSize: "10px",
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
                      color: "#ededed",
                      fontSize: "12px",
                      fontFamily: "'Geist Mono', monospace",
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <p style={{ fontSize: "11px", color: "#888" }}>{error}</p>
              )}

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="v-btn"
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: "6px",
                    border: "none",
                    background: "#fff",
                    color: "#000",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "opacity 0.15s ease",
                    opacity: isSubmitting ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) e.currentTarget.style.opacity = "0.85";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSubmitting) e.currentTarget.style.opacity = "1";
                  }}
                >
                  {isSubmitting
                    ? "Saving..."
                    : editTask
                      ? "Save Changes"
                      : "Create Task"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
