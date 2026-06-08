import { motion } from "framer-motion";

interface WorkspaceDetailViewProps {
  workspaceId: number;
  workspaceName: string;
  onBack: () => void;
}

export default function WorkspaceDetailView({
  workspaceId,
  workspaceName,
  onBack,
}: WorkspaceDetailViewProps) {
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
          ← Back
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
          {workspaceName}
        </h2>
      </div>

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
        <div style={{ fontSize: "32px", opacity: 0.2, color: "var(--text-primary)" }}>
          ◈
        </div>
        <p
          style={{
            fontSize: "12px",
            color: "var(--text-muted)",
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          Workspace #{workspaceId}
        </p>
        <p
          style={{
            fontSize: "11px",
            color: "var(--text-dim)",
            fontFamily: "'Geist Mono', monospace",
            textAlign: "center",
            maxWidth: "300px",
          }}
        >
          Click a card in the workspaces list to view its saved task layout, or press Back to return.
        </p>
      </div>
    </motion.div>
  );
}
