import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import TaskList from "@/components/TaskList";
import AddTaskModal from "@/components/AddTaskModal";
import SettingsPanel from "@/components/SettingsPanel";
import { useReminders } from "@/hooks/useReminders";
import { useReminderStore } from "@/store/reminderStore";
import { checkForUpdates, checkAndInstall } from "@/lib/updater";

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
  const isPaused = useReminderStore((s) => s.isPaused);
  const togglePaused = useReminderStore((s) => s.togglePaused);

  // ─── Update notification state ────────────────────────────────────────
  const [updateInfo, setUpdateInfo] = useState<{
    version: string;
    installing: boolean;
  } | null>(null);

  // Listen for task edit triggers from floating cards
  useEffect(() => {
    const unlisten = listen<number>("open_edit_task", (event) => {
      const taskId = event.payload;
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setEditingTask(task);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [tasks, setEditingTask]);

  // Silent update check on startup — only shows UI when update is available
  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = await checkForUpdates();
      if (result.available && result.version) {
        setUpdateInfo({ version: result.version, installing: false });
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    if (!updateInfo) return;
    setUpdateInfo((prev) => (prev ? { ...prev, installing: true } : null));
    const result = await checkAndInstall();
    if (!result.installed) {
      setUpdateInfo(null);
    }
  }, [updateInfo]);

  // Close any open modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isAddTaskOpen) {
        setAddTaskOpen(false);
        setEditingTask(null);
      }
      if (isSettingsOpen) {
        setSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isAddTaskOpen, isSettingsOpen, setAddTaskOpen, setSettingsOpen, setEditingTask]);

  const [searchQuery, setSearchQuery] = useState("");
  const incompleteCount = tasks.filter((t) => !t.completed).length;
  const isAnyModalOpen = isAddTaskOpen || isSettingsOpen;

  // ─── Live status dot — slow green pulse, hourly red alert for 1 min ─────
  const liveDotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const dot = liveDotRef.current;
    if (!dot) return;

    let alertTimeout: ReturnType<typeof setTimeout> | null = null;

    const startAlert = () => {
      dot.classList.remove("live");
      dot.classList.add("alert");
      alertTimeout = setTimeout(() => {
        dot.classList.remove("alert");
        dot.classList.add("live");
        alertTimeout = null;
      }, 60_000);
    };

    const interval = setInterval(startAlert, 60 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (alertTimeout) clearTimeout(alertTimeout);
    };
  }, []);

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
          onClick={togglePaused}
          aria-pressed={isPaused}
          disabled={isAnyModalOpen}
          title={isPaused ? "Resume card animations" : "Pause card animations"}
          style={{
            padding: "7px 14px",
            borderRadius: "8px",
            color: isPaused ? "#fff" : undefined,
            borderColor: isPaused ? "#444" : undefined,
          }}
        >
          {isPaused ? "▶ Resume" : "|| Pause"}
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              ref={liveDotRef}
              id="live-dot"
              className="dot live"
              aria-label="App heartbeat"
              title="App heartbeat — blinks red once an hour"
            />
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

      {/* ─── Update Available Toast ──────────────────────────────────── */}
      <AnimatePresence>
        {updateInfo && !updateInfo.installing && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              bottom: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 200,
              background: "#0a0a0a",
              border: "1px solid #2a2a2a",
              borderRadius: "10px",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
              maxWidth: "400px",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: "#ededed" }}>
                Update v{updateInfo.version} available
              </div>
              <div style={{ fontSize: "11px", color: "#555", marginTop: "2px" }}>
                A new version is ready to install
              </div>
            </div>
            <button
              onClick={handleInstallUpdate}
              style={{
                fontSize: "12px",
                fontWeight: 600,
                padding: "7px 14px",
                borderRadius: "8px",
                background: "#fff",
                color: "#000",
                border: "none",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Update Now
            </button>
            <button
              onClick={() => setUpdateInfo(null)}
              style={{
                fontSize: "14px",
                color: "#555",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "2px",
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* Installing state */}
        {updateInfo && updateInfo.installing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              bottom: "16px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 200,
              background: "#0a0a0a",
              border: "1px solid #2a2a2a",
              borderRadius: "10px",
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              gap: "10px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
            }}
          >
            <span style={{ fontSize: "13px", color: "#888" }}>⏳</span>
            <span style={{ fontSize: "13px", color: "#ededed" }}>
              Installing update…
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
