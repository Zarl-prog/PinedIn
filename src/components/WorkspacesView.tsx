import {
  CircleHalf,
  Diamond,
  DotOutline,
  DotsThree,
  Hexagon,
  Square,
  Star,
  Triangle,
} from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  deleteWorkspace,
  getWorkspaces,
  loadWorkspace,
  saveWorkspace,
  type Workspace,
} from "../lib/tauriCommands";
import { useReminderStore } from "../store/reminderStore";
import Skeleton from "./ui/Skeleton";
import WorkspaceDetailView from "./WorkspaceDetailView";

const WORKSPACE_ICONS = [
  Hexagon,
  Diamond,
  Square,
  DotOutline,
  Triangle,
  CircleHalf,
  Star,
  Hexagon,
  Diamond,
  Square,
] as const;

function getWorkspaceIcon(id: number): React.ElementType {
  return WORKSPACE_ICONS[id % WORKSPACE_ICONS.length];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface WorkspacesViewProps {
  onOpen?: (id: number, name: string) => void;
  onBack: () => void;
  workspaceContext: { workspaceId: number; workspaceName: string } | null;
  onAddTask: () => void;
  onPreSchedule: () => void;
}

export default function WorkspacesView({
  onOpen,
  onBack,
  workspaceContext,
  onAddTask,
  onPreSchedule,
}: WorkspacesViewProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);


  useEffect(() => {
    setLoading(true);
    getWorkspaces()
      .then((ws) => {
        setWorkspaces(ws);
      })
      .catch((e) => {
        console.error("Failed to load workspaces:", e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceContext]); // re-fetch when returning from detail

  // Close delete popover on any outside click — we don't use a ref
  // because the popover is rendered inside a mapped list and a single
  // ref can only point at one element at a time.
  useEffect(() => {
    if (deleteTarget === null) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If the click is inside any element with data-delete-popover, keep open
      if (target.closest("[data-delete-popover]")) return;
      setDeleteTarget(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [deleteTarget]);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      await saveWorkspace(newName.trim());
    } catch (e) {
      console.error("Failed to create workspace:", e);
    }
    setNewName("");
    setCreating(false);
    getWorkspaces()
      .then(setWorkspaces)
      .catch((e) => console.error("Failed to refresh workspaces:", e));
  }

  async function handleOpen(id: number, name: string) {
    if (onOpen) {
      onOpen(id, name);
    } else {
      await loadWorkspace(id);
      onBack();
    }
  }

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    setDeleteTarget(id);
  }

  async function confirmDelete(id: number) {
    setDeleteTarget(null);
    try {
      await deleteWorkspace(id);
      // Drop the in-memory task cache for this workspace so stale rows
      // don't linger until a full reload.
      useReminderStore.getState().clearWorkspaceCache(id);
    } catch (e) {
      console.error("Failed to delete workspace:", e);
    }
    getWorkspaces()
      .then(setWorkspaces)
      .catch((e) => console.error("Failed to refresh workspaces:", e));
  }

  // If in workspace detail context, show the detail view
  if (workspaceContext) {
    return (
      <AnimatePresence mode="wait">
        <WorkspaceDetailView
          key={workspaceContext.workspaceId}
          workspaceId={workspaceContext.workspaceId}
          workspaceName={workspaceContext.workspaceName}
          onBack={() => onBack()}
          onAddTask={onAddTask}
          onPreSchedule={onPreSchedule}
        />
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="workspace-list"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 10 }}
        transition={{ duration: 0.15 }}
        style={{
          padding: "24px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 600,
                color: "var(--text-primary)",
                fontFamily: "'Geist Mono', monospace",
                letterSpacing: "-0.5px",
              }}
            >
              Workspaces
            </h2>
            <p
              style={{
                fontSize: "11px",
                color: "var(--text-muted)",
                marginTop: "2px",
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              {workspaces.length} saved {workspaces.length === 1 ? "workspace" : "workspaces"}
            </p>
          </div>

          <button
            onClick={() => setCreating(true)}
            className="shiny-btn"
            style={{
              border: "none",
              borderRadius: "6px",
              padding: "7px 14px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Geist Mono', monospace",
              position: "relative",
              overflow: "hidden",
            }}
          >
            + Workspace
          </button>
        </div>

        <AnimatePresence>
          {creating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                padding: "12px",
                display: "flex",
                gap: "8px",
              }}
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") setCreating(false);
                }}
                placeholder="Workspace name..."
                style={{
                  flex: 1,
                  background: "var(--bg-app)",
                  border: "1px solid var(--border)",
                  borderRadius: "5px",
                  padding: "7px 10px",
                  color: "var(--text-primary)",
                  fontSize: "12px",
                  fontFamily: "'Geist Mono', monospace",
                  outline: "none",
                }}
              />
              <button
                onClick={handleCreate}
                style={{
                  background: "var(--text-primary)",
                  color: "var(--text-inverse)",
                  border: "none",
                  borderRadius: "5px",
                  padding: "7px 14px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Geist Mono', monospace",
                }}
              >
                Save
              </button>
              <button
                onClick={() => setCreating(false)}
                style={{
                  background: "transparent",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-light)",
                  borderRadius: "5px",
                  padding: "7px 10px",
                  fontSize: "11px",
                  cursor: "pointer",
                  fontFamily: "'Geist Mono', monospace",
                }}
              >
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "12px",
            }}
          >
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "12px",
                  padding: "16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <Skeleton width={44} height={44} borderRadius={10} />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <Skeleton width={`${50 + i * 15}%`} height={14} />
                  <Skeleton width={`${30 + i * 10}%`} height={10} />
                </div>
              </div>
            ))}
          </div>
        ) : workspaces.length === 0 && !creating ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <Hexagon
              size={32}
              weight="light"
              style={{ opacity: 0.2, color: "var(--text-primary)" }}
            />
            <p
              style={{
                fontSize: "12px",
                color: "var(--text-muted)",
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              No workspaces yet
            </p>
            <p
              style={{
                fontSize: "11px",
                color: "var(--text-dim)",
                fontFamily: "'Geist Mono', monospace",
              }}
            >
              Arrange your floating cards and save as a workspace
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
              gap: "12px",
            }}
          >
            <AnimatePresence>
              {workspaces.map((ws) => {
                let taskCount = 0;
                try {
                  const parsed = JSON.parse(ws.state_json);
                  taskCount = parsed.cards?.length ?? 0;
                } catch {}
                return (
                  <motion.div
                    key={ws.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => handleOpen(ws.id, ws.name)}
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      padding: "16px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px",
                      position: "relative",
                      transition: "border-color 0.12s, background 0.12s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-hover)";
                      e.currentTarget.style.background = "var(--bg-card-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "var(--border)";
                      e.currentTarget.style.background = "var(--bg-card)";
                    }}
                  >
                    {/* Delete trigger */}
                    <div style={{ position: "absolute", top: "12px", right: "12px" }}>
                      <button
                        data-delete-popover
                        onClick={(e) => handleDelete(e, ws.id)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-dim)",
                          cursor: "pointer",
                          fontSize: "16px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontFamily: "'Geist Mono', monospace",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-dim)")}
                      >
                        <DotsThree size={16} weight="light" />
                      </button>

                      {/* Delete confirmation popover */}
                      {deleteTarget === ws.id && (
                        <div
                          data-delete-popover
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            position: "absolute",
                            top: "32px",
                            right: "0",
                            zIndex: 20,
                            background: "var(--bg-menu)",
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            boxShadow: "var(--shadow-menu)",
                            padding: "8px",
                            minWidth: "200px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--text-secondary)",
                              padding: "4px 8px 6px",
                              lineHeight: 1.5,
                            }}
                          >
                            Delete <b style={{ color: "var(--text-primary)" }}>{ws.name}</b>? Its
                            tasks are permanently deleted. This can't be undone.
                          </div>
                          <button
                            onClick={() => confirmDelete(ws.id)}
                            style={{
                              background: "transparent",
                              border: "none",
                              borderRadius: "6px",
                              padding: "6px 10px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: "var(--text-danger)",
                              cursor: "pointer",
                              textAlign: "left",
                              fontFamily: "'Geist Mono', monospace",
                              transition: "background 0.1s",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--bg-delete-hover)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            Delete workspace &amp; tasks
                          </button>
                          <button
                            onClick={() => setDeleteTarget(null)}
                            style={{
                              background: "transparent",
                              border: "none",
                              borderRadius: "6px",
                              padding: "6px 10px",
                              fontSize: "12px",
                              color: "var(--text-secondary)",
                              cursor: "pointer",
                              textAlign: "left",
                              fontFamily: "'Geist Mono', monospace",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--bg-menu-hover)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        background: "var(--bg-hover)",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "20px",
                        color: "var(--text-primary)",
                      }}
                    >
                      {(() => {
                        const Icon = getWorkspaceIcon(ws.id);
                        return <Icon size={20} weight="light" />;
                      })()}
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          fontFamily: "'Geist Mono', monospace",
                          letterSpacing: "-0.3px",
                        }}
                      >
                        {ws.name}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--text-muted)",
                          marginTop: "4px",
                          fontFamily: "'Geist Mono', monospace",
                        }}
                      >
                        {formatDate(ws.created_at)} · {taskCount} tasks
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
