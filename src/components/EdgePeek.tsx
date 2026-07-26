import { CaretLeft, CaretRight, CheckCircle } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Task } from "../lib/tauriCommands";
import { formatCardDate } from "../lib/utils";

// Remaining time on a timed task, formatted compactly (e.g. "2h left",
// "12m left", "overdue"). Returns null when the task isn't timed or
// hasn't been started yet.
function getTimeLeft(task: Task): string | null {
  if (!task.time_limit_minutes || !task.started_at) return null;
  const totalMs = task.time_limit_minutes * 60 * 1000;
  const elapsed = Date.now() - new Date(task.started_at).getTime();
  const remaining = totalMs - elapsed;
  if (remaining <= 0) return "overdue";
  const mins = Math.round(remaining / 60000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
  }
  return `${Math.max(1, mins)}m left`;
}

export default function EdgePeek() {
  const [expanded, setExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hovered, setHovered] = useState(false);
  const [, setTick] = useState(0);
  const toggling = useRef(false);
  const autoCollapseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveringRef = useRef(false);

  const AUTO_COLLAPSE_MS = 3000;

  useEffect(() => {
    invoke<boolean>("get_edge_peek_expanded")
      .then(setExpanded)
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
    let unTasks: (() => void) | null = null;
    listen("tasks-updated", refresh).then((u) => { unTasks = u; });
    return () => {
      unTasks?.();
    };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const hasTimed = tasks.some((t) => t.time_limit_minutes && t.started_at);
    if (!hasTimed) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [expanded, tasks]);

  // Auto-collapse the expanded strip after a short idle period.
  // Resets whenever the user hovers in/out.
  useEffect(() => {
    if (!expanded) return;
    function startTimer() {
      if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current);
      autoCollapseRef.current = setTimeout(() => {
        if (!hoveringRef.current) collapse();
      }, AUTO_COLLAPSE_MS);
    }
    startTimer();
    return () => {
      if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current);
    };
  }, [expanded]);

  function handleStripEnter() {
    hoveringRef.current = true;
    if (autoCollapseRef.current) clearTimeout(autoCollapseRef.current);
  }

  function handleStripLeave() {
    hoveringRef.current = false;
    // Small grace period so quick accidental exits don't snap-shut
    autoCollapseRef.current = setTimeout(() => {
      if (!hoveringRef.current) collapse();
    }, AUTO_COLLAPSE_MS);
  }

  async function expand() {
    if (toggling.current) return;
    toggling.current = true;
    try {
      await invoke("expand_edge_peek");
      setExpanded(true);
    } finally {
      toggling.current = false;
    }
  }

  const collapse = useCallback(async () => {
    if (toggling.current) return;
    toggling.current = true;
    try {
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

  return (
    <div style={containerStyle}>
      {expanded ? (
        <div
          style={stripStyle}
          onMouseEnter={handleStripEnter}
          onMouseLeave={handleStripLeave}
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
      ) : (
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
      )}
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

  // Meta line: the due date (if set) plus any running timer countdown,
  // e.g. "Today · 2h left". Shown only when there is something to say.
  const timeLeft = getTimeLeft(task);
  const dueLabel = task.due_time ? formatCardDate(task.due_time) : "";
  const meta = [dueLabel, timeLeft].filter(Boolean).join(" · ");

  return (
    <div
      onClick={onDone}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...chipStyle,
        position: "relative",
        cursor: "pointer",
        overflow: "hidden",
        background: hovered ? "#22c55e" : "var(--pill-bg, #0A0A0A)",
        borderColor: hovered ? "#22c55e" : "var(--border-card, #1A1A1A)",
        transition: "background 150ms ease, border-color 150ms ease",
      }}
    >
      <div style={chipTextStyle}>
        <span style={{ ...chipTitleStyle, color: hovered ? "#fff" : chipTitleStyle.color }}>
          {task.title}
        </span>
        <span style={{ ...chipMetaStyle, color: hovered ? "rgba(255,255,255,0.7)" : chipMetaStyle.color }}>
          {meta}
        </span>
      </div>
      {hovered && (
        <CheckCircle
          size={32}
          weight="bold"
          style={{
            color: "rgba(255,255,255,0.6)",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        />
      )}
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
  height: "56px",
  borderRadius: "28px 0 0 28px",
  background: "var(--pill-bg, #0A0A0A)",
  border: "1px solid var(--pill-border, #1A1A1A)",
  borderRight: "none",
  cursor: "grab",
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
  height: "56px",
  background: "var(--card-bg, #0A0A0A)",
  border: "1px solid var(--border-card, #1A1A1A)",
  borderRight: "none",
  borderRadius: "28px 0 0 28px",
  display: "flex",
  flexDirection: "row",
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
  alignSelf: "center",
  transition: "color 150ms ease",
};

const taskRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  gap: "8px",
  overflowX: "auto",
  overflowY: "hidden",
  flex: 1,
  alignItems: "center",
  scrollbarWidth: "thin",
  paddingBottom: "2px",
};

const chipStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  gap: "8px",
  padding: "8px 10px",
  borderRadius: "16px",
  border: "1px solid var(--border-card, #1A1A1A)",
  background: "var(--pill-bg, #0A0A0A)",
  flexShrink: 0,
  maxWidth: "200px",
  transition: "border-color 150ms ease",
};

const chipTextStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
  minWidth: 0,
  flex: 1,
};

const chipTitleStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-primary-card, #fff)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  lineHeight: 1.1,
};

const chipMetaStyle: React.CSSProperties = {
  fontSize: "10px",
  color: "var(--text-muted-card, #666)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  lineHeight: 1,
  letterSpacing: "0.02em",
};

const emptyStyle: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--text-muted-card, #666)",
};
