import {
  ArrowRight,
  ArrowsInSimple,
  Circle,
  Eye,
  EyeSlash,
  GearSix,
  GridFour,
  Info,
  Moon,
  Newspaper,
  Pause,
  Play,
  Plus,
  SidebarSimple,
  Sun,
  Vibrate,
  Warning,
} from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useMemo, useState } from "react";
import AddTaskModal from "@/components/AddTaskModal";
import CommandPalette, { type Command } from "@/components/CommandPalette";
import ErrorBoundary from "@/components/ErrorBoundary";
import CustomizeCardModal from "@/components/CustomizeCardModal";
import McpPanel from "@/components/McpPanel";
import Onboarding from "@/components/Onboarding";
import PreScheduleModal from "@/components/PreScheduleModal";
import SettingsPanel from "@/components/SettingsPanel";
import TaskList from "@/components/TaskList";
import UndoToast from "@/components/UndoToast";
import UpdateBanner from "@/components/UpdateBanner";
import ShinyText from "@/components/ui/ShinyText";
import WorkspacesView from "@/components/WorkspacesView";
import { useReminders } from "@/hooks/useReminders";
import type { Workspace } from "@/lib/tauriCommands";
import {
  getCompactMode,
  getEdgePeekEnabled,
  getShakeEnabled,
  setCompactMode,
  setEdgePeekEnabled,
  setShakeEnabled,
  setZenMode,
  snapAllCardsToGrid,
} from "@/lib/tauriCommands";
import { checkAndInstall, checkForUpdates } from "@/lib/updater";
import { useReminderStore } from "@/store/reminderStore";

type AppTab = "tasks" | "workspaces";



export default function App() {
  useReminders();

  const tasks = useReminderStore((s) => s.tasks);
  const isAddTaskOpen = useReminderStore((s) => s.isAddTaskOpen);
  const isSettingsOpen = useReminderStore((s) => s.isSettingsOpen);
  const isPreScheduleOpen = useReminderStore((s) => s.isPreScheduleOpen);
  const isMcpOpen = useReminderStore((s) => s.isMcpOpen);
  const editingTask = useReminderStore((s) => s.editingTask);
  const isPaused = useReminderStore((s) => s.isPaused);

  // Actions — always stable, never cause re-renders
  const fetchTasks = useReminderStore.getState().fetchTasks;
  const setAddTaskOpen = useReminderStore.getState().setAddTaskOpen;
  const setSettingsOpen = useReminderStore.getState().setSettingsOpen;
  const setPreScheduleOpen = useReminderStore.getState().setPreScheduleOpen;
  const setMcpOpen = useReminderStore.getState().setMcpOpen;
  const setEditingTask = useReminderStore.getState().setEditingTask;
  const togglePaused = useReminderStore.getState().togglePaused;

  const [activeTab, setActiveTab] = useState<AppTab>("tasks");
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [workspaceContext, setWorkspaceContext] = useState<{
    workspaceId: number;
    workspaceName: string;
  } | null>(null);

  const [activeWorkspaceName, setActiveWorkspaceName] = useState<string | null>(null);

  useEffect(() => {
    invoke<number | null>("get_active_workspace_id")
      .then(async (id) => {
        if (id !== null) {
          const workspaces = await invoke<Workspace[]>("get_workspaces");
          const ws = workspaces.find((w) => w.id === id);
          if (ws) setActiveWorkspaceName(ws.name);
        }
      })
      .catch((e) => {
        console.error("Failed to get active workspace:", e);
      });
  }, []);

  useEffect(() => {
    let u1: (() => void) | null = null;
    let u2: (() => void) | null = null;
    const p1 = listen<{ name: string }>("workspace_activated", (e) => {
      setActiveWorkspaceName(e.payload.name);
    });
    const p2 = listen("workspace_deactivated", () => {
      setActiveWorkspaceName(null);
    });
    Promise.all([p1, p2]).then(([f1, f2]) => { u1 = f1; u2 = f2; });
    return () => { u1?.(); u2?.(); };
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
    let unlisten: (() => void) | null = null;
    const p = listen<number>("open_edit_task", (event) => {
      const taskId = event.payload;
      const task = useReminderStore.getState().tasks.find((t) => t.id === taskId);
      const allTasks = Object.values(useReminderStore.getState().workspaceTasks).flat();
      const found = task || allTasks.find((t) => t.id === taskId);
      if (found) {
        setEditingTask(found);
      }
    });
    p.then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const p = listen("tasks-updated", () => {
      fetchTasks();
    });
    p.then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, []);

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
      if (isMcpOpen) {
        setMcpOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isAddTaskOpen,
    isSettingsOpen,
    isPreScheduleOpen,
    isMcpOpen,
    setAddTaskOpen,
    setSettingsOpen,
    setMcpOpen,
    setPreScheduleOpen,
    setEditingTask,
  ]);

  const [zenMode, setZenModeState] = useState(false);

  // Zen mode hotkey: Ctrl+Shift+Z / Cmd+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        const next = !zenMode;
        setZenModeState(next);
        setZenMode(next).catch(() => {});
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [zenMode, setZenModeState, setZenMode]);

  async function toggleZenMode() {
    const next = !zenMode;
    setZenModeState(next);
    await setZenMode(next).catch(() => {});
  }

  const [compactMode, setCompactModeLocal] = useState(false);

  useEffect(() => {
    getCompactMode()
      .then(setCompactModeLocal)
      .catch(() => {});
  }, []);

  useEffect(() => {
    let u1: (() => void) | null = null;
    let u2: (() => void) | null = null;
    const p1 = listen("compact_mode_enabled", () => setCompactModeLocal(true));
    const p2 = listen("compact_mode_disabled", () => setCompactModeLocal(false));
    Promise.all([p1, p2]).then(([f1, f2]) => { u1 = f1; u2 = f2; });
    return () => { u1?.(); u2?.(); };
  }, []);

  const toggleCompactMode = async () => {
    const next = !compactMode;
    setCompactModeLocal(next);
    // When enabling compact mode, backend also disables edge peek (mutually exclusive)
    if (next) {
      setEdgePeekEnabledLocal(false);
    }
    try {
      await setCompactMode(next);
    } catch {
      // Roll back optimistic update if backend call failed
      setCompactModeLocal(!next);
      if (next) setEdgePeekEnabledLocal(true);
    }
  };

  const [digestEnabled, setDigestEnabledLocal] = useState(false);

  useEffect(() => {
    invoke<boolean>("get_daily_digest_enabled")
      .then(setDigestEnabledLocal)
      .catch(() => {});
  }, []);

  const toggleDigest = async () => {
    const next = !digestEnabled;
    setDigestEnabledLocal(next);
    await invoke("set_daily_digest_enabled", { enabled: next }).catch(() => {});
    if (next) {
      // Open the digest popup immediately when toggled on
      await invoke("open_daily_digest_window").catch(() => {});
    }
  };

  const [shakeEnabled, setShakeEnabledLocal] = useState(false);

  useEffect(() => {
    getShakeEnabled()
      .then(setShakeEnabledLocal)
      .catch(() => {});
  }, []);

  const [edgePeekEnabled, setEdgePeekEnabledLocal] = useState(false);
  // Show a "new" dot on the Edge Peek feature until the user tries it once.
  const [edgePeekSeen, setEdgePeekSeen] = useState(
    () => localStorage.getItem("edgePeekSeen") === "1",
  );

  useEffect(() => {
    getEdgePeekEnabled()
      .then(setEdgePeekEnabledLocal)
      .catch(() => {});
    let u1: (() => void) | null = null;
    let u2: (() => void) | null = null;
    const p1 = listen("compact_mode_enabled", () => setEdgePeekEnabledLocal(false));
    const p2 = listen("edge_peek_disabled", () => setEdgePeekEnabledLocal(false));
    Promise.all([p1, p2]).then(([f1, f2]) => { u1 = f1; u2 = f2; });
    return () => { u1?.(); u2?.(); };
  }, []);

  const toggleShake = async () => {
    const next = !shakeEnabled;
    setShakeEnabledLocal(next);
    await setShakeEnabled(next).catch(() => {});
  };

  const toggleEdgePeek = async () => {
    if (!edgePeekSeen) {
      setEdgePeekSeen(true);
      localStorage.setItem("edgePeekSeen", "1");
    }
    const next = !edgePeekEnabled;
    setEdgePeekEnabledLocal(next);
    // When enabling edge peek, backend also disables compact mode (mutually exclusive)
    if (next) {
      setCompactModeLocal(false);
    }
    try {
      await setEdgePeekEnabled(next);
    } catch {
      setEdgePeekEnabledLocal(!next);
      if (next) setCompactModeLocal(true);
    }
  };

  const [showWaylandWarning, setShowWaylandWarning] = useState(false);
  const [showGnomeTrayWarning, setShowGnomeTrayWarning] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const p = listen("show_wayland_warning", () => {
      setShowWaylandWarning(true);
    });
    p.then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const p = listen("show_gnome_tray_warning", () => {
      setShowGnomeTrayWarning(true);
    });
    p.then((u) => { unlisten = u; });
    return () => { unlisten?.(); };
  }, []);

  const [searchQuery, setSearchQuery] = useState("");
  const incompleteCount = tasks.filter((t) => !t.completed).length;

  // ─── Cmd/Ctrl+K opens the command palette ──────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleTabChange(tab: AppTab) {
    setActiveTab(tab);
    setWorkspaceContext(null);
    if (tab === "tasks") {
      invoke("deactivate_workspace").catch(() => {});
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

  // ─── Command palette command list ──────────────────────────────────────
  const paletteCommands = useMemo<Command[]>(() => {
    const setTheme = (t: string) => useReminderStore.getState().saveSetting("theme", t);
    const cmds: Command[] = [
      {
        id: "add-task",
        title: "Add Task",
        subtitle: "Create a new floating task card",
        group: "Tasks",
        keywords: "new create task todo",
        icon: <Plus size={15} weight="bold" />,
        perform: () => setAddTaskOpen(true),
      },
      {
        id: "pre-schedule",
        title: "Pre-Schedule Task",
        subtitle: "Schedule a task for later",
        group: "Tasks",
        keywords: "schedule later future remind",
        icon: <ArrowRight size={15} weight="bold" />,
        perform: () => setPreScheduleOpen(true),
      },
      {
        id: "toggle-pause",
        title: isPaused ? "Resume reminders" : "Pause reminders",
        group: "Tasks",
        keywords: "pause resume stop notifications",
        icon: isPaused ? <Play size={15} weight="bold" /> : <Pause size={15} weight="bold" />,
        perform: () => togglePaused(),
      },
      {
        id: "compact",
        title: "Toggle Compact mode",
        subtitle: "Collapse cards into a pill",
        group: "View",
        keywords: "compact pill collapse minimize",
        icon: <ArrowsInSimple size={15} weight="bold" />,
        perform: () => toggleCompactMode(),
      },
      {
        id: "zen",
        title: "Toggle Zen mode",
        subtitle: "Hide all cards to focus",
        group: "View",
        keywords: "zen focus hide",
        icon: <EyeSlash size={15} weight="bold" />,
        perform: () => toggleZenMode(),
      },
      {
        id: "align",
        title: "Align cards to grid",
        subtitle: "Snap floating cards into a grid",
        group: "View",
        keywords: "align grid snap tidy arrange",
        icon: <GridFour size={15} weight="bold" />,
        perform: () => snapAllCardsToGrid(),
      },
      {
        id: "shake",
        title: "Toggle Shake",
        subtitle: "Pulse urgent tasks",
        group: "View",
        keywords: "shake pulse urgent",
        icon: <Vibrate size={15} weight="bold" />,
        perform: () => toggleShake(),
      },
      {
        id: "settings",
        title: "Open Settings",
        group: "App",
        keywords: "settings preferences config options",
        icon: <GearSix size={15} weight="bold" />,
        perform: () => setSettingsOpen(true),
      },
      {
        id: "restart-tour",
        title: "Restart onboarding tour",
        group: "App",
        keywords: "tour onboarding help guide walkthrough",
        icon: <Info size={15} weight="bold" />,
        perform: () => {
          emit("show_onboarding").catch(() => {});
        },
      },
      {
        id: "theme-light",
        title: "Theme: Light",
        group: "Theme",
        keywords: "theme light color appearance",
        icon: <Sun size={15} weight="bold" />,
        perform: () => setTheme("light"),
      },
      {
        id: "theme-dark",
        title: "Theme: Dark",
        group: "Theme",
        keywords: "theme dark color appearance",
        icon: <Moon size={15} weight="bold" />,
        perform: () => setTheme("dark"),
      },
      {
        id: "theme-parchment",
        title: "Theme: Parchment",
        group: "Theme",
        keywords: "theme parchment sepia warm color appearance",
        icon: <Circle size={15} weight="bold" />,
        perform: () => setTheme("parchment"),
      },
    ];
    return cmds;
  }, [
    isPaused,
    setAddTaskOpen,
    setPreScheduleOpen,
    togglePaused,
    toggleCompactMode,
    toggleZenMode,
    toggleShake,
    setSettingsOpen,
  ]);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        background: "var(--bg-app)",
        border: "1px solid var(--app-border, rgba(255, 255, 255, 0.18))",
        borderRadius: "8px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxSizing: "border-box",
      }}
    >
      <Onboarding />
      {/* Top accent border — makes window edge very visible */}
      <div
        style={{
          height: "1px",
          width: "100%",
          background: "var(--accent-line)",
          flexShrink: 0,
        }}
      />
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
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-inverse)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-14 0Z" />
              <circle cx="12" cy="9" r="2.5" fill="var(--text-inverse)" stroke="none" />
            </svg>
          </div>
          <ShinyText
            text="PinedIn"
            speed={4}
            className="font-semibold"
            style={{ fontSize: "14px" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={() => setMcpOpen(true)}
            title="MCP Server"
            className="feature-btn ghost"
            style={{
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#22c55e",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="#22c55e"
              fillRule="evenodd"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M15.688 2.343a2.588 2.588 0 00-3.61 0l-9.626 9.44a.863.863 0 01-1.203 0 .823.823 0 010-1.18l9.626-9.44a4.313 4.313 0 016.016 0 4.116 4.116 0 011.204 3.54 4.3 4.3 0 013.609 1.18l.05.05a4.115 4.115 0 010 5.9l-8.706 8.537a.274.274 0 000 .393l1.788 1.754a.823.823 0 010 1.18.863.863 0 01-1.203 0l-1.788-1.753a1.92 1.92 0 010-2.754l8.706-8.538a2.47 2.47 0 000-3.54l-.05-.049a2.588 2.588 0 00-3.607-.003l-7.172 7.034-.002.002-.098.097a.863.863 0 01-1.204 0 .823.823 0 010-1.18l7.273-7.133a2.47 2.47 0 00-.003-3.537z" />
              <path d="M14.485 4.703a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a4.115 4.115 0 000 5.9 4.314 4.314 0 006.016 0l7.12-6.982a.823.823 0 000-1.18.863.863 0 00-1.204 0l-7.119 6.982a2.588 2.588 0 01-3.61 0 2.47 2.47 0 010-3.54l7.12-6.982z" />
            </svg>
          </button>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setSettingsOpen(true)}
              title="Settings"
              data-onboarding="settings"
              className="feature-btn ghost"
              style={{
                padding: "4px",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
                  background: "var(--text-danger)",
                  borderRadius: "50%",
                }}
              />
            )}
          </div>
          <button
            onClick={() =>
              getCurrentWindow()
                .minimize()
                .catch(() => {})
            }
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.12s ease, color 0.12s ease",
            }}
            title="Minimize"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <svg width="10" height="1" viewBox="0 0 10 1" fill="none">
              <rect width="10" height="1" fill="currentColor" />
            </svg>
          </button>
          <button
            onClick={() =>
              getCurrentWindow()
                .toggleMaximize()
                .catch(() => {})
            }
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.12s ease, color 0.12s ease",
            }}
            title="Maximize"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-hover)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" fill="none" />
            </svg>
          </button>
          <button
            onClick={() =>
              getCurrentWindow()
                .close()
                .catch(() => {})
            }
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              fontFamily: "'Segoe MDL2 Assets', 'Arial Unicode MS', sans-serif",
              transition: "background 0.12s ease, color 0.12s ease",
            }}
            title="Close"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#ef4444";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M1 1L8 8M8 1L1 8" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ─── Wayland Warning ──────────────────────────────────── */}
      {showWaylandWarning && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "12px 16px",
            margin: "8px 14px",
            fontSize: "11px",
            fontFamily: "'Geist Mono', monospace",
            color: "var(--text-primary)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            <Warning size={15} weight="light" /> Wayland detected
          </span>
          <span style={{ color: "var(--text-secondary)" }}>
            Always-on-top floating cards require the X11 backend on GNOME. Run PinedIn with:
          </span>
          <code
            style={{
              background: "var(--bg-hover)",
              padding: "6px 10px",
              borderRadius: "4px",
              color: "var(--text-primary)",
              fontSize: "10px",
            }}
          >
            GDK_BACKEND=x11 pinedin
          </code>
          <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
            Or install the{" "}
            <a
              href="https://extensions.gnome.org/extension/8324/always-on-top"
              target="_blank"
              style={{ color: "var(--text-primary)" }}
              rel="noopener"
            >
              Always on Top
            </a>{" "}
            GNOME extension and pin PinedIn windows manually.
          </span>
          <button
            onClick={() => setShowWaylandWarning(false)}
            style={{
              alignSelf: "flex-end",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              borderRadius: "4px",
              padding: "4px 10px",
              fontSize: "10px",
              cursor: "pointer",
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            Got it
          </button>
        </div>
      )}

      {/* ─── GNOME Tray Warning ────────────────────────────────── */}
      {showGnomeTrayWarning && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            padding: "12px 16px",
            margin: "8px 14px",
            fontSize: "11px",
            fontFamily: "'Geist Mono', monospace",
            color: "var(--text-primary)",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "6px" }}>
            <Info size={15} weight="light" /> GNOME detected
          </span>
          <span style={{ color: "var(--text-secondary)" }}>
            The system tray icon requires the AppIndicator extension on GNOME.
          </span>
          <a
            href="https://extensions.gnome.org/extension/615/appindicator-support"
            target="_blank"
            style={{ color: "var(--text-primary)", fontSize: "10px" }}
            rel="noopener"
          >
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              Install AppIndicator Extension <ArrowRight size={14} weight="bold" />
            </span>
          </a>
          <button
            onClick={() => setShowGnomeTrayWarning(false)}
            style={{
              alignSelf: "flex-end",
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--text-muted)",
              borderRadius: "4px",
              padding: "4px 10px",
              fontSize: "10px",
              cursor: "pointer",
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            Got it
          </button>
        </div>
      )}

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
            background: "var(--bg-card)",
            borderBottom: "1px solid var(--border)",
            padding: "6px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "11px",
            fontFamily: "'Geist Mono', monospace",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Circle size={12} weight="fill" /> Workspace active:{" "}
            <strong>{activeWorkspaceName}</strong>
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
        className={activeTab === "tasks" ? "tasks-body" : undefined}
        data-onboarding={activeTab === "tasks" ? "task-list" : undefined}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: activeTab === "tasks" ? "16px" : 0,
          minHeight: 0,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <UpdateBanner />
        {activeTab === "tasks" && (
          <>
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
                  style={{
                    fontSize: "15px",
                    fontWeight: 600,
                    fontFamily: "'Geist Mono', monospace",
                    letterSpacing: "-0.3px",
                    color: "var(--text-primary)",
                  }}
                >
                  Tasks
                </span>
                <ShinyText
                  text={`${incompleteCount} tasks remaining`}
                  speed={6}
                  className=""
                  style={{ fontSize: "11px" }}
                />
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button onClick={() => setPreScheduleOpen(true)} className="feature-btn">
                  + Pre-Schedule
                </button>
                <button
                  onClick={() => setAddTaskOpen(true)}
                  className="feature-btn primary"
                  data-onboarding="add-task"
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
                style={{ paddingLeft: "32px", paddingRight: "58px" }}
              />
            </div>

            {/* Task List */}
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <TaskList searchQuery={searchQuery} />
            </div>
          </>
        )}

        {activeTab === "workspaces" && (
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
              position: "relative",
              backgroundImage:
                "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          >
            <ErrorBoundary>
              <WorkspacesView
                onOpen={handleWorkspaceOpen}
                onBack={handleWorkspaceBack}
                workspaceContext={workspaceContext}
                onAddTask={() => setAddTaskOpen(true)}
                onPreSchedule={() => setPreScheduleOpen(true)}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>

      {/* ─── Bottom Bar ──────────────────────────────────────── */}
      <div
        style={{
          height: "44px",
          minHeight: "44px",
          background: "var(--bg-app)",
          borderTop: "1px solid var(--divider)",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "0 16px",
          zIndex: 50,
        }}
      >
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          title="Open command palette (Ctrl+K)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "transparent",
            border: "none",
            borderRadius: "4px",
            padding: "4px 6px",
            fontSize: "11px",
            fontFamily: "'Geist Mono', monospace",
            color: "var(--text-muted)",
            cursor: "pointer",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <img src="/Mac-Command--Streamline-Carbon.svg" alt="" style={{ width: "12px", height: "12px", opacity: 0.6 }} />
          <span style={{ opacity: 0.6 }}>K</span>
        </button>
        <button
          onClick={togglePaused}
          className="feature-btn"
          style={
            isPaused
              ? {
                  borderBottom: "2px solid var(--accent)",
                }
              : undefined
          }
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {isPaused ? (
              <>
                <Play size={15} weight="light" /> Resume
              </>
            ) : (
              <>
                <Pause size={15} weight="light" /> Pause
              </>
            )}
          </span>
        </button>
        <div className="feature-seg" data-onboarding="compact">
          <button
            onClick={toggleCompactMode}
            className={`feature-seg-btn${compactMode ? " active" : ""}`}
          >
            <ArrowsInSimple size={15} weight="light" /> Compact
          </button>
          <button
            onClick={toggleEdgePeek}
            className={`feature-seg-btn${edgePeekEnabled ? " active" : ""}`}
          >
            <SidebarSimple size={15} weight="light" /> Slide
            {!edgePeekSeen && (
              <span className="feature-new-dot" aria-label="New feature" title="New" />
            )}
          </button>
        </div>
        <button
          onClick={toggleDigest}
          className="feature-btn"
          style={
            digestEnabled
              ? {
                  borderBottom: "2px solid var(--accent)",
                }
              : undefined
          }
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Newspaper size={15} weight="light" /> Digest
          </span>
        </button>
        <button
          onClick={toggleZenMode}
          className="feature-btn"
          data-onboarding="zen"
          style={
            zenMode
              ? {
                  borderBottom: "2px solid var(--accent)",
                }
              : undefined
          }
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {zenMode ? (
              <>
                <EyeSlash size={15} weight="light" /> Zen On
              </>
            ) : (
              <>
                <Eye size={15} weight="light" /> Zen
              </>
            )}
          </span>
        </button>
        <button onClick={() => snapAllCardsToGrid()} className="feature-btn" data-onboarding="align">
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <GridFour size={15} weight="light" /> Align
          </span>
        </button>
        <button
          onClick={toggleShake}
          className="feature-btn"
          style={
            shakeEnabled
              ? {
                  borderBottom: "2px solid var(--accent)",
                }
              : undefined
          }
        >
          <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {shakeEnabled ? (
              <>
                <Vibrate size={15} weight="light" /> Shake On
              </>
            ) : (
              <>
                <Vibrate size={15} weight="light" /> Shake
              </>
            )}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          title="Open command palette (Ctrl+K)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "transparent",
            border: "none",
            borderRadius: "4px",
            padding: "4px 6px",
            fontSize: "11px",
            fontFamily: "'Geist Mono', monospace",
            color: "var(--text-muted)",
            cursor: "pointer",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <img src="/Mac-Command--Streamline-Carbon.svg" alt="" style={{ width: "12px", height: "12px", opacity: 0.6 }} />
          <span style={{ opacity: 0.6 }}>K</span>
        </button>
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

      <McpPanel open={isMcpOpen} onClose={() => setMcpOpen(false)} />

      <CustomizeCardModal />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={paletteCommands}
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
              borderRadius: "14px",
              boxShadow: "var(--shadow-menu)",
              padding: "24px",
            }}
          >
            <div
              style={{
                fontSize: "17px",
                fontWeight: 600,
                color: "var(--text-primary)",
                marginBottom: "12px",
              }}
            >
              New Version Available
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "8px" }}>
              PinedIn v{updateAvailable} is ready to install.
            </p>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "20px" }}>
              Your current version: v0.3.9
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
                  await checkAndInstall();
                }}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--accent)",
                  color: "var(--accent-contrast)",
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "opacity 0.15s ease",
                }}
              >
                Update Now
        </button>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          title="Open command palette (Ctrl+K)"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            background: "transparent",
            border: "none",
            borderRadius: "4px",
            padding: "4px 6px",
            fontSize: "11px",
            fontFamily: "'Geist Mono', monospace",
            color: "var(--text-muted)",
            cursor: "pointer",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          <img src="/Mac-Command--Streamline-Carbon.svg" alt="" style={{ width: "12px", height: "12px", opacity: 0.6 }} />
          <span style={{ opacity: 0.6 }}>K</span>
        </button>
      </div>
          </div>
        </div>
      )}

      <UndoToast />
    </div>
  );
}
