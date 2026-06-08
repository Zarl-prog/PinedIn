import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getWorkspaces, saveWorkspace, loadWorkspace, deleteWorkspace, Workspace } from "../lib/tauriCommands";

const WORKSPACE_ICONS = ["⬡", "◈", "⬟", "◉", "⬠", "◍", "⬢", "◎", "⬣", "◐"];

function getWorkspaceIcon(id: number): string {
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
}

export default function WorkspacesView({ onOpen, onBack }: WorkspacesViewProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    getWorkspaces().then(setWorkspaces);
  }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    await saveWorkspace(newName.trim());
    setNewName("");
    setCreating(false);
    getWorkspaces().then(setWorkspaces);
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
    await deleteWorkspace(id);
    getWorkspaces().then(setWorkspaces);
  }

  return (
    <motion.div
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
          <button
            onClick={onBack}
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              padding: "6px 12px",
              color: "var(--text-muted)",
              fontSize: "12px",
              fontFamily: "'Geist Mono', monospace",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.borderColor = "var(--border-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            ← Tasks
          </button>
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

      {workspaces.length === 0 && !creating ? (
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
          <div style={{ fontSize: "32px", opacity: 0.2, color: "var(--text-primary)" }}>⬡</div>
          <p style={{ fontSize: "12px", color: "var(--text-muted)", fontFamily: "'Geist Mono', monospace" }}>
            No workspaces yet
          </p>
          <p style={{ fontSize: "11px", color: "var(--text-dim)", fontFamily: "'Geist Mono', monospace" }}>
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
                  <div style={{ position: "absolute", top: "12px", right: "12px" }}>
                    <button
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
                      ···
                    </button>
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
                    {getWorkspaceIcon(ws.id)}
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
  );
}
