import { Minus, PencilSimpleLine, Plus, X } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { Task } from "@/lib/tauriCommands";
import { useReminderStore } from "@/store/reminderStore";

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

/** Minimal themed dropdown — avoids native <select> which ignores CSS vars */
function UnitDropdown({
  value,
  onChange,
}: {
  value: TimeLimitUnit;
  onChange: (v: TimeLimitUnit) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selected = TIME_LIMIT_UNITS.find((u) => u.value === value)!;

  return (
    <div ref={ref} style={{ position: "relative" }} id={id}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "8px 10px",
          color: "var(--text-primary)",
          fontSize: "12px",
          fontFamily: "'Geist Mono', monospace",
          cursor: "pointer",
          whiteSpace: "nowrap",
          transition: "border-color 0.15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-hover)")}
        onMouseLeave={(e) =>
          (e.currentTarget.style.borderColor = open ? "var(--text-muted)" : "var(--border)")
        }
      >
        {selected.label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="var(--text-muted)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            minWidth: "100%",
            background: "var(--bg-dropdown)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            boxShadow: "var(--shadow-menu)",
            zIndex: 200,
            overflow: "hidden",
          }}
        >
          {TIME_LIMIT_UNITS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 12px",
                background: opt.value === value ? "var(--bg-hover)" : "transparent",
                border: "none",
                color: opt.value === value ? "var(--text-primary)" : "var(--text-secondary)",
                fontSize: "12px",
                fontFamily: "'Geist Mono', monospace",
                cursor: "pointer",
                transition: "background 0.1s ease, color 0.1s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--bg-menu-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  opt.value === value ? "var(--bg-hover)" : "transparent";
                e.currentTarget.style.color =
                  opt.value === value ? "var(--text-primary)" : "var(--text-secondary)";
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * AddTaskModal - Monochrome modal for creating or editing an *immediate* task.
 * Pre-schedule lives in its own dedicated PreScheduleModal — no toggle here.
 * All styling uses the exact palette from the spec: #0a0a0a, #1a1a1a, #ededed, etc.
 */
export default function AddTaskModal({ open, onClose, editTask, workspaceId }: AddTaskModalProps) {
  const addTask = useReminderStore((s) => s.addTask);
  const editTaskAction = useReminderStore((s) => s.editTask);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [timeLimitValue, setTimeLimitValue] = useState("");
  const [timeLimitUnit, setTimeLimitUnit] = useState<TimeLimitUnit>("minutes");
  const tagInputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitRef = useRef<() => Promise<void>>();

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (submittingRef.current) return;
    submittingRef.current = true;

    setIsSubmitting(true);
    setError(null);

    try {
      const tagsString = tags.length > 0 ? tags.join(",") : "";
      const timeLimitMinutes = timeLimitValue
        ? parseInt(timeLimitValue, 10) * (timeLimitUnit === "hours" ? 60 : 1)
        : null;
      const safeTimeLimit = timeLimitMinutes && timeLimitMinutes > 0 ? timeLimitMinutes : null;

      if (editTask?.id != null) {
        await editTaskAction(
          editTask.id,
          title.trim(),
          description.trim(),
          dueDate || "",
          recurrence,
          tagsString || null,
          safeTimeLimit,
        );
      } else {
        await addTask(
          title.trim(),
          description.trim(),
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
      submittingRef.current = false;
    }
  };

  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  });

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmitRef.current?.();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDueDate("");
    setRecurrence(null);
    setTags([]);
    setTagInput("");
    setTimeLimitValue("");
    setTimeLimitUnit("minutes");
    setError(null);
    setShowAdvanced(false);
  };

  useEffect(() => {
    if (editTask) {
      setTitle(editTask.title);
      setDescription(editTask.description);
      setDueDate(editTask.due_time || "");
      setRecurrence(editTask.recurrence ?? null);
      setTags(
        editTask.tags
          ? editTask.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
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
            padding: "24px",
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
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: "420px",
              background: "var(--bg-modal)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              boxShadow: "var(--shadow-menu)",
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
              <span
                style={{
                  fontSize: "17px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
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
                  Due Date <span style={{ color: "var(--text-muted)" }}>(optional)</span>
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

              {(() => {
                const advancedCount =
                  (timeLimitValue ? 1 : 0) + (recurrence ? 1 : 0) + (tags.length > 0 ? 1 : 0);
                return (
                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    style={{
                      fontSize: "12px",
                      padding: "8px 16px",
                      alignSelf: "flex-start",
                      cursor: "pointer",
                      fontFamily: "'Geist Mono', monospace",
                      fontWeight: 500,
                      borderRadius: "6px",
                      border: "1px solid var(--border-light, #444)",
                      background: "transparent",
                      color: "var(--text-secondary)",
                      transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--bg-hover)";
                      e.currentTarget.style.color = "var(--text-primary)";
                      e.currentTarget.style.borderColor = "var(--border-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "var(--text-secondary)";
                      e.currentTarget.style.borderColor = "var(--border-light, #444)";
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        justifyContent: "center",
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {showAdvanced ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
                      </svg>
                      {showAdvanced
                        ? "Basic"
                        : advancedCount > 0
                          ? `Advanced (${advancedCount})`
                          : "Advanced"}
                    </span>
                  </button>
                );
              })()}

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
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
                        Time Limit <span style={{ color: "var(--text-muted)" }}>(optional)</span>
                      </label>
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            background: "var(--bg-input)",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            overflow: "hidden",
                            width: "130px",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setTimeLimitValue((v) =>
                                String(Math.max(1, (parseInt(v, 10) || 0) - 1) || ""),
                              )
                            }
                            style={{
                              width: "30px",
                              height: "34px",
                              background: "transparent",
                              border: "none",
                              borderRight: "1px solid var(--border)",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              fontSize: "16px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              transition: "background 0.1s ease, color 0.1s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--bg-hover)";
                              e.currentTarget.style.color = "var(--text-primary)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "var(--text-muted)";
                            }}
                          >
                            <Minus size={14} weight="light" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            placeholder="No limit"
                            value={timeLimitValue}
                            onChange={(e) => setTimeLimitValue(e.target.value)}
                            style={{
                              flex: 1,
                              width: 0,
                              background: "transparent",
                              border: "none",
                              color: "var(--text-primary)",
                              fontSize: "12px",
                              fontFamily: "'Geist Mono', monospace",
                              textAlign: "center",
                              outline: "none",
                              padding: "8px 4px",
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setTimeLimitValue((v) => String((parseInt(v, 10) || 0) + 1))
                            }
                            style={{
                              width: "30px",
                              height: "34px",
                              background: "transparent",
                              border: "none",
                              borderLeft: "1px solid var(--border)",
                              color: "var(--text-muted)",
                              cursor: "pointer",
                              fontSize: "16px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              transition: "background 0.1s ease, color 0.1s ease",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--bg-hover)";
                              e.currentTarget.style.color = "var(--text-primary)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "var(--text-muted)";
                            }}
                          >
                            <Plus size={14} weight="light" />
                          </button>
                        </div>
                        <UnitDropdown value={timeLimitUnit} onChange={setTimeLimitUnit} />
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
                        Tags <span style={{ color: "var(--text-muted)" }}>(max 5)</span>
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
                              <X size={11} weight="light" />
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
                  </motion.div>
                )}
              </AnimatePresence>

              {error && (
                <p
                  style={{
                    fontSize: "13px",
                    color: "var(--text-danger)",
                    fontWeight: 500,
                    marginTop: "8px",
                  }}
                >
                  {error}
                </p>
              )}

              <div style={{ display: "flex", justifyContent: "center", marginTop: "12px" }}>
                <button
                  onClick={() => {
                    onClose();
                    useReminderStore.getState().setCustomizeOpen(true);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    fontSize: "12px",
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                    opacity: 0.7,
                    transition: "opacity 0.15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
                >
                  <PencilSimpleLine size={14} weight="light" style={{ marginRight: "4px" }} />{" "}
                  Customize your tasks
                </button>
              </div>

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
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      fontSize: "10px",
                      opacity: 0.5,
                      marginLeft: "8px",
                    }}
                  >
                    Ctrl
                    <svg width="13" height="13" viewBox="0 -960 960 960" fill="currentColor">
                      <path d="M360-240 120-480l240-240 56 56-144 144h488v-160h80v240H272l144 144-56 56Z" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
