import { useState, useEffect, Component, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import TaskList from "@/components/TaskList";
import AddTaskModal from "@/components/AddTaskModal";
import SettingsPanel from "@/components/SettingsPanel";
import PreScheduleModal from "@/components/PreScheduleModal";
import UpdateBanner from "@/components/UpdateBanner";
import WorkspacesView from "@/components/WorkspacesView";
import { useReminders } from "@/hooks/useReminders";
import { useReminderStore } from "@/store/reminderStore";
import { setZenMode, snapAllCardsToGrid } from "@/lib/tauriCommands";
import { checkForUpdates } from "@/lib/updater";
import ShinyText from "@/components/ui/ShinyText";
import type { Workspace } from "@/lib/tauriCommands";

type AppTab = "tasks" | "workspaces";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("ErrorBoundary caught:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, color: "var(--text-secondary)", fontSize: 13, fontFamily: "'Geist Mono', monospace" }}>
          Something went wrong. Please restart the app.
        </div>
      );
    }
    return this.props.children;
  }
}

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

  const [workspaceContext, setWorkspaceContext] = useState<{ workspaceId: number; workspaceName: string } | null>(null);

  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string | null>(null);

  useEffect(() => {
    invoke<number | null>("get_active_workspace_id").then(async (id) => {
      if (id !== null) {
        const workspaces = await invoke<Workspace[]>("get_workspaces");
        const ws = workspaces.find((w) => w.id === id);
        if (ws) setActiveWorkspaceName(ws.name);
      }
    });
  }, []);

  useEffect(() => {
    const unlistenActivated = listen<{ name: string }>("workspace_activated", (e) => {
      setActiveWorkspaceName(e.payload.name);
    });
    const unlistenDeactivated = listen("workspace_deactivated", () => {
      setActiveWorkspaceName(null);
    });
    return () => {
      unlistenActivated.then((f) => f());
      unlistenDeactivated.then((f) => f());
    };
  }, []);

  const [updateAvailable, setUpdateAvailable] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  useEffect(() => {
    checkForUpdates().then((result) => {
      if (result.available && result.version) {
        setUpdateAvailable(result.version);
        setShowUpdateModal(true);
      }
    });
  }, []);

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

  useEffect(() => {
    const unlisten = listen("tasks-updated", () => {
      fetchTasks();
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, [fetchTasks]);

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

  function handleTabChange(tab: AppTab) {
    setActiveTab(tab);
    setWorkspaceContext(null);
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
      {/* ─── Titlebar ─────────────────────────────────────────── */}
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
          <ShinyText text="PinedIn" speed={4} className="font-semibold" style={{ fontSize: "14px" }} />
          <span style={{ fontSize: "9px", fontWeight: 500, fontFamily: "'Geist Mono', monospace", letterSpacing: "-0.1px", opacity: 0.6, color: "var(--text-muted)" }}>
            Persistent Task Overlay
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              className="feature-btn ghost"
              style={{
                padding: "4px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
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

      {/* ─── Tab Bar ─────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          padding: "6px 16px",
          borderBottom: "1px solid var(--divider)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => handleTabChange("tasks")}
          className="feature-btn"
          style={{
            fontSize: "12px",
            fontWeight: activeTab === "tasks" ? 600 : 400,
            background: activeTab === "tasks" ? "var(--text-primary)" : "",
            color: activeTab === "tasks" ? "var(--text-inverse)" : "",
            borderColor: activeTab === "tasks" ? "var(--text-primary)" : "",
            borderRadius: "6px",
            padding: "6px 14px",
          }}
        >
          Tasks
        </button>
        <button
          onClick={() => handleTabChange("workspaces")}
          className="feature-btn"
          style={{
            fontSize: "12px",
            fontWeight: activeTab === "workspaces" ? 600 : 400,
            background: activeTab === "workspaces" ? "var(--text-primary)" : "",
            color: activeTab === "workspaces" ? "var(--text-inverse)" : "",
            borderColor: activeTab === "workspaces" ? "var(--text-primary)" : "",
            borderRadius: "6px",
            padding: "6px 14px",
          }}
        >
          Workspace
        </button>
      </div>

      {/* ─── Active Workspace Banner ──────────────────────────── */}
      {activeWorkspaceName && (
        <div
          style={{
            background: "#0a0a0a",
            borderBottom: "1px solid #1a1a1a",
            padding: "6px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11px",
            fontFamily: "'Geist Mono', monospace",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#ffffff" }}>
            ● Workspace active: <strong>{activeWorkspaceName}</strong>
          </span>
          <button
            onClick={() => invoke("deactivate_workspace")}
            className="feature-btn"
            style={{ fontSize: "10px", padding: "3px 8px" }}
          >
            Deactivate
          </button>
        </div>
      )}

      {/* ─── Body ─────────────────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: activeTab === "tasks" ? "16px" : 0,
          paddingBottom: activeTab === "tasks" ? "52px" : 0,
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
                <span style={{ fontSize: "15px", fontWeight: 600, fontFamily: "'Geist Mono', monospace", letterSpacing: "-0.3px", color: "var(--text-primary)" }}>
                  Tasks
                </span>
                <ShinyText text={`${incompleteCount} tasks remaining`} speed={6} className="" style={{ fontSize: "11px" }} />
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  onClick={() => setPreScheduleOpen(true)}
                  className="feature-btn"
                >
                  + Pre-Schedule
                </button>
                <button
                  onClick={() => setAddTaskOpen(true)}
                  className="feature-btn primary"
                  style={{ fontSize: "11px", padding: "6px 12px" }}
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

            {/* Task List */}
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <TaskList searchQuery={searchQuery} />
            </div>
          </>
        )}

        {activeTab === "workspaces" && (
          <ErrorBoundary key={workspaceContext ? "detail" : "list"}>
            <WorkspacesView
              onOpen={handleWorkspaceOpen}
              onBack={handleWorkspaceBack}
              workspaceContext={workspaceContext}
              onAddTask={() => setAddTaskOpen(true)}
              onPreSchedule={() => setPreScheduleOpen(true)}
            />
          </ErrorBoundary>
        )}
      </div>

      {/* ─── Bottom Bar ──────────────────────────────────────── */}
      {activeTab === "tasks" && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: "44px",
            background: "#000",
            borderTop: "1px solid #111",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "0 16px",
            zIndex: 50,
          }}
        >
          <button
            onClick={togglePaused}
            className="feature-btn"
            style={{
              color: isPaused ? "#ffffff" : "",
              borderColor: isPaused ? "#555" : "",
            }}
          >
            {isPaused ? "▶ Resume" : "|| Pause"}
          </button>
          <button
            onClick={toggleZenMode}
            className="feature-btn"
            style={{
              color: zenMode ? "#ffffff" : "",
              borderColor: zenMode ? "#555" : "",
            }}
          >
            {zenMode ? "◎ Zen On" : "◎ Zen"}
          </button>
          <button
            onClick={() => snapAllCardsToGrid()}
            className="feature-btn"
          >
            ⊞ Align
          </button>
        </div>
      )}

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

      {/* Update Modal */}
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
