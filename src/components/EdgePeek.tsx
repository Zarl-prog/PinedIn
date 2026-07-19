import { CaretRight, CheckCircle } from "@phosphor-icons/react";
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
  const expandedRef = useRef(expanded);

  useEffect(() => {
    expandedRef.current = expanded;
  }, [expanded]);

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
    const unAutoHide = listen("edge_peek_auto_hide", () => {
      if (expandedRef.current) collapse();
    });
    return () => {
      unTasks.then((f) => f());
      unAutoHide.then((f) => f());
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
            ...panelStyle,
            opacity: visible ? 1 : 0,
            transition: "opacity 150ms ease",
          }}
        >
          <div style={headerStyle}>
            <span style={headerTitleStyle}>
              Tasks &middot; {tasks.length}
            </span>
            <button
              onClick={collapse}
              style={collapseButtonStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--border-card-strong, #333)";
                e.currentTarget.style.color = "var(--text-primary-card, #fff)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-card, #1A1A1A)";
                e.currentTarget.style.color = "var(--text-muted-card, #666)";
              }}
            >
              <CaretRight size={13} weight="light" />
            </button>
          </div>

          <div style={taskListStyle}>
            {tasks.length === 0 ? (
              <div style={emptyStyle}>All clear</div>
            ) : (
              tasks.map((task) => (
                <TaskRow
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
        <CaretRight
          size={16}
          weight="light"
          style={{
            color: "var(--pill-text, #fff)",
            flexShrink: 0,
            transform: hovered ? "translateX(4px)" : "translateX(0)",
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

function TaskRow({ task, onDone }: { task: Task; onDone: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...taskCardStyle,
        borderColor: hovered
          ? "var(--border-card-hover, #2A2A2A)"
          : "var(--border-card, #1A1A1A)",
      }}
    >
      <div style={taskTitleStyle}>{task.title}</div>
      {task.description && (
        <div style={taskDescStyle}>{task.description}</div>
      )}
      {task.due_time && (
        <div style={taskDueStyle}>due {task.due_time}</div>
      )}
      <button
        onClick={onDone}
        style={doneButtonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "var(--border-card-strong, #444)";
          e.currentTarget.style.color = "var(--text-primary-card, #fff)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--border-card-hover, #2A2A2A)";
          e.currentTarget.style.color = "var(--text-secondary-card, #AAA)";
        }}
      >
        <CheckCircle size={13} weight="light" /> Done
      </button>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const containerStyle: React.CSSProperties = {
  width: "100%",
  height: "100%",
  background: "var(--pill-bg, #0A0A0A)",
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

const panelStyle: React.CSSProperties = {
  width: "320px",
  height: "100%",
  background: "var(--card-bg, #0A0A0A)",
  border: "1px solid var(--border-card, #1A1A1A)",
  borderRadius: "16px 0 0 16px",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  fontFamily: "'Geist Mono', monospace",
};

const headerStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid var(--border-card-light, #111)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexShrink: 0,
  background: "var(--card-bg, #0A0A0A)",
};

const headerTitleStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-primary-card, #fff)",
  fontFamily: "'Geist Mono', monospace",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};

const collapseButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border-card, #1A1A1A)",
  borderRadius: "6px",
  width: "28px",
  height: "28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text-muted-card, #666)",
  cursor: "pointer",
  transition: "border-color 120ms, color 120ms",
};

const taskListStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const emptyStyle: React.CSSProperties = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--text-muted-card, #333)",
  fontSize: "12px",
};

const taskCardStyle: React.CSSProperties = {
  background: "var(--card-bg, #0A0A0A)",
  border: "1px solid var(--border-card, #1A1A1A)",
  borderRadius: "10px",
  padding: "12px 14px",
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  cursor: "default",
  transition: "border-color 120ms ease",
};

const taskTitleStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--text-primary-card, #fff)",
  lineHeight: 1.3,
};

const taskDescStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "var(--text-faint-card, rgba(255,255,255,0.38))",
  lineHeight: 1.4,
};

const taskDueStyle: React.CSSProperties = {
  fontSize: "10px",
  color: "var(--text-faint-card, rgba(255,255,255,0.25))",
};

const doneButtonStyle: React.CSSProperties = {
  marginTop: "4px",
  padding: "6px",
  borderRadius: "7px",
  border: "1px solid var(--border-card-hover, #2A2A2A)",
  background: "transparent",
  color: "var(--text-secondary-card, #AAA)",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "'Geist Mono', monospace",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "5px",
  transition: "border-color 120ms, color 120ms",
};
