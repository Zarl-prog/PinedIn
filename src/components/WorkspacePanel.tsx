import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getWorkspaces, saveWorkspace, loadWorkspace, deleteWorkspace, Workspace } from "../lib/tauriCommands";

export default function WorkspacePanel() {
  const [open, setOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    if (open) getWorkspaces().then(setWorkspaces);
  }, [open]);

  async function handleSave() {
    if (!newName.trim()) return;
    await saveWorkspace(newName.trim());
    setNewName("");
    getWorkspaces().then(setWorkspaces);
  }

  async function handleLoad(id: number) {
    await loadWorkspace(id);
    setOpen(false);
  }

  async function handleDelete(id: number) {
    await deleteWorkspace(id);
    getWorkspaces().then(setWorkspaces);
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="v-btn"
        onClick={() => setOpen(o => !o)}
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: "11px",
          color: open ? "var(--text-primary)" : "var(--text-secondary)",
          background: open ? "var(--border)" : "transparent",
          border: open ? "1px solid var(--text-muted)" : "1px solid var(--border-light)",
          borderRadius: "5px",
          padding: "5px 10px",
          cursor: "pointer"
        }}
      >
        ⊡ Workspaces
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              top: "36px",
              left: 0,
              width: "240px",
              background: "var(--bg-dropdown)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              padding: "12px",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}
          >
            <div style={{ display: "flex", gap: "6px" }}>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSave()}
                placeholder="Workspace name..."
                style={{
                  flex: 1,
                  background: "var(--bg-app)",
                  border: "1px solid var(--border)",
                  borderRadius: "5px",
                  padding: "5px 8px",
                  color: "var(--text-primary)",
                  fontSize: "11px",
                  fontFamily: "'Geist Mono', monospace"
                }}
              />
              <button
                onClick={handleSave}
                style={{
                  background: "var(--text-primary)",
                  color: "var(--text-inverse)",
                  border: "none",
                  borderRadius: "5px",
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Geist Mono', monospace"
                }}
              >
                Save
              </button>
            </div>

            {workspaces.length > 0 && (
              <div style={{ height: "1px", background: "var(--divider)" }} />
            )}

            {workspaces.length === 0 && (
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", padding: "8px 0" }}>
                No saved workspaces
              </div>
            )}

            {workspaces.map(ws => (
              <div
                key={ws.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "6px"
                }}
              >
                <button
                  onClick={() => handleLoad(ws.id)}
                  style={{
                    flex: 1,
                    textAlign: "left",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "5px",
                    padding: "5px 8px",
                    color: "var(--text-primary)",
                    fontSize: "11px",
                    cursor: "pointer",
                    fontFamily: "'Geist Mono', monospace"
                  }}
                >
                  {ws.name}
                </button>
                <button
                  onClick={() => handleDelete(ws.id)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "5px",
                    padding: "5px 7px",
                    color: "var(--text-muted)",
                    fontSize: "11px",
                    cursor: "pointer"
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
