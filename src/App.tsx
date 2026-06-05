import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import TaskList from "@/components/TaskList";
import AddTaskModal from "@/components/AddTaskModal";
import SettingsPanel from "@/components/SettingsPanel";
import { useReminders } from "@/hooks/useReminders";
import { useReminderStore } from "@/store/reminderStore";

/**
 * PinedIn - Main application window.
 * Full monochrome task management UI.
 */
export default function App() {
  useReminders();

  const tasks = useReminderStore((s) => s.tasks);
  const isAddTaskOpen = useReminderStore((s) => s.isAddTaskOpen);
  const setAddTaskOpen = useReminderStore((s) => s.setAddTaskOpen);
  const isSettingsOpen = useReminderStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useReminderStore((s) => s.setSettingsOpen);
  const editingTask = useReminderStore((s) => s.editingTask);
  const setEditingTask = useReminderStore((s) => s.setEditingTask);

  // Close modals on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isAddTaskOpen) {
          setAddTaskOpen(false);
          setEditingTask(null);
        }
        if (isSettingsOpen) setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddTaskOpen, isSettingsOpen, setAddTaskOpen, setSettingsOpen, setEditingTask]);

  const [searchQuery, setSearchQuery] = useState("");
  const incompleteCount = tasks.filter((t) => !t.completed).length;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#000",
        overflow: "hidden",
      }}
    >
      {/* ─── Custom Titlebar ──────────────────────────────────────────── */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px 8px",
          borderBottom: "1px solid #1a1a1a",
          flexShrink: 0,
        }}
      >
        {/* Left: Logo + App Name + Subtitle */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Logo: white square with black pin icon */}
          <div
            style={{
              width: "28px",
              height: "28px",
              background: "#fff",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-14 0Z" />
              <circle cx="12" cy="9" r="2.5" fill="#000" stroke="none" />
            </svg>
          </div>
          <div>
            <span style={{ fontSize: "15px", fontWeight: 600, color: "#ededed", lineHeight: 1.2 }}>
              PinedIn
            </span>
            <div style={{ fontSize: "12px", color: "#444", lineHeight: 1.2, marginTop: "2px" }}>
              Persistent task overlay
            </div>
          </div>
        </div>

        {/* Right: Window Control Dots */}
        <div style={{ display: "flex", gap: "6px" }}>
          {/* Minimize */}
          <button
            onClick={() => getCurrentWindow().minimize()}
            style={{
              width: "11px",
              height: "11px",
              borderRadius: "999px",
              border: "1px solid #2e2e2e",
              background: "#222",
              cursor: "pointer",
              padding: 0,
              transition: "background 0.15s ease",
            }}
            title="Minimize"
            onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#222")}
          />
          {/* Maximize/Restore */}
          <button
            onClick={() => getCurrentWindow().toggleMaximize()}
            style={{
              width: "11px",
              height: "11px",
              borderRadius: "999px",
              border: "1px solid #2e2e2e",
              background: "#222",
              cursor: "pointer",
              padding: 0,
              transition: "background 0.15s ease",
            }}
            title="Maximize"
            onMouseEnter={(e) => (e.currentTarget.style.background = "#333")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#222")}
          />
          {/* Close */}
          <button
            onClick={() => getCurrentWindow().close()}
            style={{
              width: "11px",
              height: "11px",
              borderRadius: "999px",
              border: "1px solid #2e2e2e",
              background: "#222",
              cursor: "pointer",
              padding: 0,
              transition: "background 0.15s ease",
            }}
            title="Close"
            onMouseEnter={(e) => (e.currentTarget.style.background = "#444")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#222")}
          />
        </div>
      </div>

      {/* ─── Toolbar ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          padding: "8px 16px",
          borderBottom: "1px solid #1a1a1a",
          flexShrink: 0,
        }}
      >
        {/* Quick Add */}
        <button
          className="v-btn"
          onClick={() => setAddTaskOpen(true)}
          style={{
            padding: "7px 14px",
            borderRadius: "8px",
          }}
        >
          + Quick Add
        </button>
        {/* Pause */}
        <button
          className="v-btn"
          style={{
            padding: "7px 14px",
            borderRadius: "8px",
          }}
        >
          || Pause
        </button>
        {/* Settings */}
        <button
          className="v-btn"
          onClick={() => setSettingsOpen(true)}
          style={{
            padding: "7px 14px",
            borderRadius: "8px",
          }}
        >
          /\ Settings
        </button>
      </div>

      {/* ─── Body ─────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "16px",
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {/* Tasks Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
            <span style={{ fontSize: "16px", fontWeight: 600, color: "#ededed" }}>
              Tasks
            </span>
            <span style={{ fontSize: "12px", color: "#444" }}>
              {incompleteCount} task{incompleteCount !== 1 ? "s" : ""} remaining
            </span>
          </div>
          <button
            onClick={() => setAddTaskOpen(true)}
            style={{
              fontSize: "12px",
              fontWeight: 600,
              padding: "7px 16px",
              borderRadius: "8px",
              background: "#fff",
              color: "#000",
              border: "none",
              cursor: "pointer",
              transition: "opacity 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            + Add Task
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: "relative", marginBottom: "12px", flexShrink: 0 }}>
          <svg
            width="14"
            height="14"
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
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input-field"
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: "32px" }}
          />
        </div>

        {/* Task List */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          <TaskList searchQuery={searchQuery} />
        </div>
      </div>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid #1a1a1a",
          textAlign: "center",
          fontSize: "12px",
          color: "#2a2a2a",
          flexShrink: 0,
        }}
      >
        PinedIn v0.1.0 — Always-on-task overlay
      </div>

      {/* Modals */}
      <AddTaskModal
        open={isAddTaskOpen}
        onClose={() => {
          setAddTaskOpen(false);
          setEditingTask(null);
        }}
        editTask={editingTask}
      />

      <SettingsPanel
        open={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}
