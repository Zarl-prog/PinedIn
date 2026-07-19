import { CaretLeft, CaretRight, CheckCircle } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "../lib/tauriCommands";

export default function EdgePeek() {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const toggling = useRef(false);

  useEffect(() => {
    invoke<boolean>("get_edge_peek_expanded")
      .then((exp) => {
        setExpanded(exp);
        if (exp) setVisible(true);
      })
      .catch(() => {});
  }, []);

  async function refresh() {
    try {
      const all = await invoke<Task[]>("get_incomplete_tasks");
      setTasks(all);
    } catch (_) {}
  }

  useEffect(() => {
    refresh();
    const unTasks = listen("tasks-updated", refresh);
    return () => {
      unTasks.then((f) => f());
    };
  }, []);

  async function expand() {
    if (toggling.current) return;
    toggling.current = true;
    try {
      await invoke("expand_edge_peek");
      setExpanded(true);
      requestAnimationFrame(() => setVisible(true));
    } finally {
      toggling.current = false;
    }
  }

  const collapse = useCallback(async () => {
    if (toggling.current) return;
    toggling.current = true;
    try {
      setVisible(false);
      await new Promise((r) => setTimeout(r, 150));
      await invoke("collapse_edge_peek");
      setExpanded(false);
    } finally {
      toggling.current = false;
    }
  }, []);

  async function handleDone(id: number | undefined | null) {
    if (!id) return;
    await invoke("complete_task", { id });
    refresh();
  }

  if (expanded) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            ...stripStyle,
            opacity: visible ? 1 : 0,
            transition: "opacity 150ms ease",
          }}
        >
          <button
            onClick={collapse}
            style={chevronButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary-card, #fff)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted-card, #666)";
            }}
          >
            <CaretRight size={14} weight="light" />
          </button>

          <div style={taskRowStyle}>
            {tasks.length === 0 ? (
              <span style={emptyStyle}>All clear</span>
            ) : (
              tasks.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  onDone={() => handleDone(task.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div
        onClick={expand}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          ...pillStyle,
          borderColor: hovered
            ? "var(--border-card-strong, #333)"
            : "var(--pill-border, #1A1A1A)",
        }}
      >
        <CaretLeft
          size={14}
          weight="light"
          style={{
            color: "var(--pill-text, #fff)",
            flexShrink: 0,
            transform: hovered ? "translateX(-3px)" : "translateX(0)",
            transition: "transform 150ms ease",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
          <span style={countStyle}>{tasks.length}</span>
          <span style={labelStyle}>TASKS</span>
        </div>
      </div>
    </div>
  );
}

function TaskChip({
  task,
  onDone,
}: {
  task: Task;
  onDone: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...chipStyle,
        borderColor: hovered
          ? "var(--border-card-hover, #2A2A2A)"
          : "var(--border-card, #1A1A1A)",
      }}
    >
      <span style={chipTitleStyle}>{task.title}</span>
      <button
        onClick={onDone}
        style={chipDoneStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--text-primary-card, #fff)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--text-muted-card, #666)";
        }}
      >
        <CheckCircle size={13} weight="light" />
      </button>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  background: "transparent",
  display: "flex",
  justifyContent: "flex-end",
  alignItems: "center",
  overflow: "hidden",
};

const pillStyle: React.CSSProperties = {
  width: "80px",
  height: "68px",
  borderRadius: "34px 0 0 34px",
  background: "var(--pill-bg, #0A0A0A)",
  border: "1px solid var(--pill-border, #1A1A1A)",
  borderRight: "none",
  cursor: "pointer",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "flex-start",
  paddingLeft: "14px",
  gap: "8px",
  userSelect: "none",
  transition: "border-color 150ms ease",
};

const countStyle: React.CSSProperties = {
  fontSize: "17px",
  fontWeight: 500,
  color: "var(--pill-text, #fff)",
  fontFamily: "'Geist Mono', monospace",
  lineHeight: 1,
  letterSpacing: "-0.02em",
};

const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  color: "var(--pill-text-muted, #666)",
  fontFamily: "'Geist Mono', monospace",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  lineHeight: 1,
};

const stripStyle: React.CSSProperties = {
  width: "100%",
  height: "68px",
  background: "var(--card-bg, #0A0A0A)",
  border: "1px solid var(--border-card, #1A1A1A)",
  borderRight: "none",
  borderRadius: "34px 0 0 34px",
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  paddingLeft: "12px",
  paddingRight: "8px",
  gap: "10px",
  overflow: "hidden",
  fontFamily: "'Geist Mono', monospace",
};

const chevronButtonStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-muted-card, #666)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px",
  flexShrink: 0,
  transition: "color 150ms ease",
};

const taskRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: "8px",
  overflow: "hidden",
  flex: 1,
  alignItems: "center",
};

const chipStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "6px",
  padding: "6px 10px",
  borderRadius: "16px",
  border: "1px solid var(--border-card, #1A1A1A)",
  background: "var(--pill-bg, #0A0A0A)",
  flexShrink: 0,
  maxWidth: "180px",
  transition: "border-color 150ms ease",
};

const chipTitleStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-primary-card, #fff)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  lineHeight: 1,
};

const chipDoneStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--text-muted-card, #666)",
  display: "flex",
  alignItems: "center",
  padding: "2px",
  flexShrink: 0,
  transition: "color 150ms ease",
};

const emptyStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted-card, #666)",
};
