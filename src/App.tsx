import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import TaskList from "@/components/TaskList";
import AddTaskModal from "@/components/AddTaskModal";
import SettingsPanel from "@/components/SettingsPanel";
import PreScheduleModal from "@/components/PreScheduleModal";
import ShinyText from "@/components/ui/ShinyText";
import UpdateBanner from "@/components/UpdateBanner";
import WorkspacesView from "@/components/WorkspacesView";
import { useReminders } from "@/hooks/useReminders";
import { useReminderStore } from "@/store/reminderStore";
import { getShakeInterval, setShakeInterval, setZenMode, snapAllCardsToGrid } from "@/lib/tauriCommands";
import { checkForUpdates } from "@/lib/updater";

const SHAKE_OPTIONS = [10, 15, 30, 60, 120, 300];

type AppTab = "tasks" | "workspaces";

export default function App() {
  useReminders();

  const tasks = useReminderStore((s) => s.tasks);
  const fetchTasks = useReminderStore((s) => s.fetchTasks);
  const isAddTaskOpen = useReminderStore((s) => s.isAddTaskOpen);
  const setAddTaskOpen = useReminderStore((s) => s.setAddTaskOpen);
  const isSettingsOpen = useReminderStore((s) => s.isSettingsOpen);
  const setSettingsOpen = useReminderStore((s) => s.setSettingsOpen);
  const isPreScheduleOpen = useReminderStore((s) => s.isPreScheduleOpen);
  const setPreScheduleOpen = useReminderStore((s) => s.setPreScheduleOpen);
  const editingTask = useReminderStore((s) => s.editingTask);
  const setEditingTask = useReminderStore((s) => s.setEditingTask);
  const isPaused = useReminderStore((s) => s.isPaused);
  const togglePaused = useReminderStore((s) => s.togglePaused);

  const [activeTab, setActiveTab] = useState<AppTab>("tasks");

  // Workspace detail sub-view state (managed by WorkspacesView internally)
  const [workspaceContext, setWorkspaceContext] = useState<{ workspaceId: number; workspaceName: string } | null>(null);

  // Update check state
  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Check for updates on mount
  useEffect(() => {
    checkForUpdates().then((result) => {
      if (result.available && result.version) {
        setUpdateAvailable(result.version);
        setShowUpdateModal(true);
      }
    });
  }, []);

  // Listen for task edit triggers from floating cards
  useEffect(() => {
    const unlisten = listen<number>("open_edit_task", (event) => {
      const taskId = event.payload;
      const task = tasks.find((t) => t.id === taskId);
      const allTasks = Object.values(useReminderStore.getState().workspaceTasks).flat();
      const found = task || allTasks.find((t) => t.id === taskId);
      if (found) {
        setEditingTask(found);
      }
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [tasks, setEditingTask]);

  // Refresh task list when backend emits tasks-updated
  useEffect(() => {
    const unlisten = listen("tasks-updated", () => {
      fetchTasks();
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [fetchTasks]);

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
      if (isPreScheduleOpen) {
        setPreScheduleOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isAddTaskOpen,
    isSettingsOpen,
    isPreScheduleOpen,
    setAddTaskOpen,
    setSettingsOpen,
    setPreScheduleOpen,
    setEditingTask,
  ]);

  const [zenMode, setZenModeState] = useState(false);

  async function toggleZenMode() {
    const next = !zenMode;
    setZenModeState(next);
    await setZenMode(next).catch(() => {});
  }

  const [searchQuery, setSearchQuery] = useState("");
  const incompleteCount = tasks.filter((t) => !t.completed).length;
  const isAnyModalOpen = isAddTaskOpen || isSettingsOpen || isPreScheduleOpen;

  const [shakeInterval, setShakeIntervalLocal] = useState<number>(30);
  useEffect(() => {
    getShakeInterval()
      .then((s) => setShakeIntervalLocal(s))
      .catch(() => {});
  }, []);

  const handleShakeChange = (value: number) => {
    setShakeIntervalLocal(value);
    setShakeInterval(value).catch(() => {});
  };

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

  function handleTabChange(tab: AppTab) {
    setActiveTab(tab);
    if (tab === "tasks") {
      setWorkspaceContext(null);
    } else {
      // coming from tasks to workspaces – show list
      setWorkspaceContext(null);
    }
  }

  function handleWorkspaceOpen(id: number, name: string) {
    setActiveTab("workspaces");
    setWorkspaceContext({ workspaceId: id, workspaceName: name });
  }

  function handleWorkspaceBack() {
    setWorkspaceContext(null);
  }

  const effectiveWorkspaceId = workspaceContext?.workspaceId ?? null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "var(--bg-app)",
        overflow: "hidden",
      }}
    >
      {/* ─── Custom Titlebar + Tab Bar ──────────────────────────────────── */}
      <div
        data-tauri-drag-region
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px 8px",
          borderBottom: "1px solid var(--divider)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              background: "var(--text-primary)",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-inverse)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-14 0Z" />
              <circle cx="12" cy="9" r="2.5" fill="var(--text-inverse)" stroke="none" />
            </svg>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ShinyText text="PinedIn" speed={4} className="text-white font-semibold text-sm" />
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.2, marginTop: "2px" }}>
              Persistent task overlay
            </div>
          </div>
        </div>

        {/* ─── Persistent Tab Navigation ──────────────────────────────── */}
        <div style={{ display: "flex", gap: "4px" }}>
          <button
            onClick={() => handleTabChange("tasks")}
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: "12px",
              fontWeight: activeTab === "tasks" ? 600 : 400,
              background: activeTab === "tasks" ? "var(--text-primary)" : "transparent",
              color: activeTab === "tasks" ? "var(--text-inverse)" : "var(--text-secondary)",
              border: `1px solid ${activeTab === "tasks" ? "var(--text-primary)" : "var(--border)"}`,
              borderRadius: "6px",
              padding: "6px 14px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Tasks
          </button>
          <button
            onClick={() => handleTabChange("workspaces")}
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: "12px",
              fontWeight: activeTab === "workspaces" ? 600 : 400,
              background: activeTab === "workspaces" ? "var(--text-primary)" : "transparent",
              color: activeTab === "workspaces" ? "var(--text-inverse)" : "var(--text-secondary)",
              border: `1px solid ${activeTab === "workspaces" ? "var(--text-primary)" : "var(--border)"}`,
              borderRadius: "6px",
              padding: "6px 14px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            Workspace
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              style={{
                background: "none",
                border: "none",
                padding: "4px",
                cursor: "pointer",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
                transition: "color 0.15s ease, background 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.background = "var(--bg-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-secondary)";
                e.currentTarget.style.background = "none";
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            {updateAvailable && (
              <span
                style={{
                  position: "absolute",
                  top: "0px",
                  right: "0px",
                  width: "8px",
                  height: "8px",
                  background: "#ef4444",
                  borderRadius: "50%",
                }}
              />
            )}
          </div>
          <button
            onClick={() => getCurrentWindow().minimize()}
            style={{
              width: "11px",
              height: "11px",
              borderRadius: "999px",
              border: "1px solid var(--border-hover)",
              background: "var(--bg-hover)",
              cursor: "pointer",
              padding: 0,
              transition: "background 0.15s ease",
            }}
            title="Minimize"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--text-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          />
          <button
            onClick={() => getCurrentWindow().toggleMaximize()}
            style={{
              width: "11px",
              height: "11px",
              borderRadius: "999px",
              border: "1px solid var(--border-hover)",
              background: "var(--bg-hover)",
              cursor: "pointer",
              padding: 0,
              transition: "background 0.15s ease",
            }}
            title="Maximize"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--text-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-hover")}
          />
          <button
            onClick={() => getCurrentWindow().close()}
            style={{
              width: "11px",
              height: "11px",
              borderRadius: "999px",
              border: "1px solid var(--border-hover)",
              background: "var(--bg-hover)",
              cursor: "pointer",
              padding: 0,
              transition: "background 0.15s ease",
            }}
            title="Close"
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--text-muted)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
          />
        </div>
      </div>

      {/* ─── Toolbar (only shown on Tasks tab) ─────────────────────────── */}
      {activeTab === "tasks" && (
        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "8px 16px",
            borderBottom: "1px solid var(--divider)",
            flexShrink: 0,
            alignItems: "center",
          }}
        >
          <button
            className="v-btn"
            onClick={togglePaused}
            aria-pressed={isPaused}
            disabled={isAnyModalOpen}
            title={isPaused ? "Resume card animations" : "Pause card animations"}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              color: isPaused ? "var(--text-primary)" : undefined,
              borderColor: isPaused ? "var(--text-muted)" : undefined,
            }}
          >
            {isPaused ? "▶ Resume" : "|| Pause"}
          </button>

          <button
            className="v-btn"
            onClick={toggleZenMode}
            aria-pressed={zenMode}
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: "11px",
              borderRadius: "5px",
              padding: "5px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              color: zenMode ? "var(--text-primary)" : undefined,
              background: zenMode ? "var(--border)" : undefined,
              borderColor: zenMode ? "var(--text-muted)" : undefined,
            }}
          >
            {zenMode ? "◎ Zen On" : "◎ Zen"}
          </button>
          <button
            className="v-btn"
            onClick={() => snapAllCardsToGrid()}
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: "11px",
              borderRadius: "5px",
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            ⊞ Align
          </button>

          {/* Shake interval — compact inline control */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "auto" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Shake every</span>
            <select
              value={shakeInterval}
              onChange={(e) => handleShakeChange(Number(e.target.value))}
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border)",
                borderRadius: "5px",
                padding: "4px 8px",
                color: "var(--text-secondary)",
                fontSize: "11px",
                fontFamily: "'Geist Mono', monospace",
                cursor: "pointer",
              }}
            >
              {SHAKE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s < 60 ? `${s}s` : s === 60 ? "1m" : s === 120 ? "2m" : "5m"}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* ─── Body ─────────────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: activeTab === "tasks" ? "16px" : 0,
          minHeight: 0,
          overflow: "hidden",
        }}
      >
        {activeTab === "tasks" && (
          <>
            <UpdateBanner />

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
                <ShinyText text="Tasks" speed={3} className="text-lg font-semibold" />
                <ShinyText text={`${incompleteCount} task${incompleteCount !== 1 ? "s" : ""} remaining`} speed={5} className="text-sm" />
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  className="v-btn"
                  onClick={() => setPreScheduleOpen(true)}
                  style={{
                    borderRadius: "5px",
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontFamily: "'Geist Mono', monospace",
                    cursor: "pointer",
                  }}
                >
                  + Pre-Schedule
                </button>
                <button
                  onClick={() => setAddTaskOpen(true)}
                  style={{
                    background: "var(--text-primary)",
                    border: "none",
                    borderRadius: "5px",
                    padding: "6px 12px",
                    color: "var(--text-inverse)",
                    fontSize: "11px",
                    fontWeight: 600,
                    fontFamily: "'Geist Mono', monospace",
                    cursor: "pointer",
                    transition: "opacity 0.15s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  + Add Task
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <div style={{ position: "relative", marginBottom: "12px", flexShrink: 0 }}>
              <svg
                width="14"
                height="14"
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

            {/* Task List (global only) */}
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <TaskList searchQuery={searchQuery} />
            </div>
          </>
        )}

        {activeTab === "workspaces" && (
          <WorkspacesView
            onOpen={handleWorkspaceOpen}
            onBack={handleWorkspaceBack}
            workspaceContext={workspaceContext}
            onAddTask={() => setAddTaskOpen(true)}
            onPreSchedule={() => setPreScheduleOpen(true)}
          />
        )}
      </div>

      {/* ─── Footer ───────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "10px 16px",
          borderTop: "1px solid var(--divider)",
          textAlign: "center",
          fontSize: "13px",
          color: "var(--text-dim)",
          flexShrink: 0,
        }}
      >
        PinedIn v0.3.1 — Always-on-task overlay
      </div>

      {/* Modals */}
      <AddTaskModal
        open={isAddTaskOpen}
        onClose={() => {
          setAddTaskOpen(false);
          setEditingTask(null);
        }}
        editTask={editingTask}
        workspaceId={effectiveWorkspaceId}
      />

      <PreScheduleModal
        open={isPreScheduleOpen}
        onClose={() => setPreScheduleOpen(false)}
        workspaceId={effectiveWorkspaceId}
      />

      <SettingsPanel
        open={isSettingsOpen}
        onClose={() => setSettingsOpen(false)}
        updateAvailable={updateAvailable}
      />

      {/* ─── Update Modal ──────────────────────────────────────────────── */}
      {showUpdateModal && updateAvailable && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--bg-overlay)",
            }}
            onClick={() => setShowUpdateModal(false)}
          />
          <div
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: "400px",
              background: "var(--bg-modal)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "24px",
            }}
          >
            <div style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "12px" }}>
              New Version Available
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              PinedIn v{updateAvailable} is ready to install.
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
              Your current version: v0.3.1
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setShowUpdateModal(false)}
                className="v-btn"
                style={{ flex: 1, padding: "8px 0", borderRadius: "8px", fontSize: "14px" }}
              >
                Dismiss
              </button>
              <button
                onClick={async () => {
                  const { checkAndInstall } = await import("@/lib/updater");
                  await checkAndInstall();
                }}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--text-primary)",
                  color: "var(--text-inverse)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity 0.15s ease",
                }}
              >
                Update Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
