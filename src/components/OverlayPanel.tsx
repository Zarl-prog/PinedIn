import { useEffect, useState, useRef, useCallback } from "react";
import { getCurrentWindow, PhysicalPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { getAllTasks, completeTask, saveOverlayPosition, getOverlayPosition, Task } from "../lib/tauriCommands";

export default function OverlayPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const dragState = useRef<{
    offsetX: number;
    offsetY: number;
    scaleFactor: number;
    window: ReturnType<typeof getCurrentWindow>;
  } | null>(null);

  // Initialize window ref and restore saved position (matching Java restore behavior)
  useEffect(() => {
    const win = getCurrentWindow();
    dragState.current = { offsetX: 0, offsetY: 0, scaleFactor: 1, window: win };

    // Restore saved overlay position from database (like Java restores task position)
    getOverlayPosition().then((saved: [number, number] | null) => {
      if (saved) {
        win.setPosition(new PhysicalPosition(saved[0], saved[1]));
      }
    });
  }, []);

  async function refresh() {
    const all = await getAllTasks();
    setTasks(all.filter(t => !t.completed));
  }

  useEffect(() => {
    refresh();
    const unlisten = listen("tasks-updated", refresh);
    return () => { unlisten.then(f => f()); };
  }, []);

  async function handleDone(id: number) {
    await completeTask(id);
    await refresh();
  }

  /* ─── Java-style drag: exact pattern from FloatingTaskWindow.java ─── */
  // Java: onMousePressed → dragOffset = screenPos - windowPos
  // Java: onMouseDragged  → windowPos = screenPos - offset

  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    // Only start drag from the header bar
    if (!(e.target as HTMLElement)?.closest?.("[data-drag-handle]")) return;

    const cur = dragState.current!;
    const win = cur.window;
    const pos = await win.outerPosition();
    const scale = await win.scaleFactor();

    // Convert screenX (CSS/logical pixels) to physical pixels for consistency
    const physicalScreenX = e.screenX * scale;
    const physicalScreenY = e.screenY * scale;

    cur.offsetX = physicalScreenX - pos.x;
    cur.offsetY = physicalScreenY - pos.y;
    cur.scaleFactor = scale;

    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(async (e: MouseEvent) => {
    if (!isDragging) return;

    const { offsetX, offsetY, scaleFactor, window: win } = dragState.current!;
    const newX = e.screenX * scaleFactor - offsetX;
    const newY = e.screenY * scaleFactor - offsetY;

    await win.setPosition(new PhysicalPosition(newX, newY));
  }, [isDragging]);

  const handleMouseUp = useCallback(async () => {
    if (isDragging) {
      setIsDragging(false);
      // Persist position
      const pos = await dragState.current!.window.outerPosition();
      await saveOverlayPosition(pos.x, pos.y);
    }
  }, [isDragging]);

  // Attach document-level listeners for reliable drag tracking
  useEffect(() => {
    if (!isDragging) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        background: "#111113",
        width: "300px",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Segoe UI', sans-serif",
        cursor: isDragging ? "grabbing" : "default",
        userSelect: isDragging ? "none" : "auto",
      }}
    >
      {/* Drag handle bar */}
      <div
        data-drag-handle
        style={{
          cursor: isDragging ? "grabbing" : "grab",
          padding: "12px 16px",
          fontSize: "12px",
          fontWeight: 600,
          color: "rgba(255,255,255,0.5)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          userSelect: "none",
          letterSpacing: "0.05em"
        }}
      >
        ACTIVE TASKS · {tasks.length}
      </div>

      {/* Task list */}
      <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {tasks.length === 0 && (
          <div style={{
            textAlign: "center",
            color: "rgba(255,255,255,0.2)",
            padding: "40px 20px",
            fontSize: "13px"
          }}>
            ✓ All clear
          </div>
        )}
        {tasks.map(task => (
          <div
            key={task.id}
            style={{
              background: "#1c1c20",
              borderRadius: "12px",
              padding: "14px 16px",
              border: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              flexDirection: "column",
              gap: "4px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#ffffff", lineHeight: 1.3 }}>
                {task.title}
              </span>
              <span style={{
                fontSize: "10px",
                padding: "2px 7px",
                borderRadius: "999px",
                marginLeft: "8px",
                flexShrink: 0,
                background: task.urgency === "critical" ? "rgba(239,68,68,0.15)" : task.urgency === "medium" ? "rgba(245,158,11,0.15)" : "rgba(34,197,94,0.15)",
                color: task.urgency === "critical" ? "#ef4444" : task.urgency === "medium" ? "#f59e0b" : "#22c55e",
                border: `1px solid ${task.urgency === "critical" ? "rgba(239,68,68,0.3)" : task.urgency === "medium" ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.3)"}`
              }}>
                {task.urgency}
              </span>
            </div>

            {task.description && (
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.38)", lineHeight: 1.4 }}>
                {task.description}
              </span>
            )}

            {task.due_time && (
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "2px" }}>
                📅 {task.due_time}
              </span>
            )}

            <button
              onClick={() => handleDone(task.id!)}
              style={{
                marginTop: "10px",
                padding: "6px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.45)",
                fontSize: "11px",
                cursor: "pointer",
                width: "100%",
                transition: "all 0.15s ease"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.09)";
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.color = "rgba(255,255,255,0.45)";
              }}
            >
              ✓ Mark Done
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
