import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { getAllTasks, completeTask, Task } from "../lib/tauriCommands";

export default function OverlayPanel() {
  const [tasks, setTasks] = useState<Task[]>([]);

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

  return (
    <div style={{
      background: "#0f0f11",
      width: "300px",
      minHeight: "100vh",
      color: "#fff",
      fontFamily: "sans-serif",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Drag Handle */}
      <div
        onMouseDown={() => getCurrentWindow().startDragging()}
        style={{
          cursor: "grab",
          padding: "10px",
          textAlign: "center",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          fontSize: "12px",
          color: "rgba(255,255,255,0.4)",
          userSelect: "none"
        }}
      >
        ⠿ Active Tasks ({tasks.length})
      </div>

      {/* Task list */}
      <div style={{ padding: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {tasks.length === 0 && (
          <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", padding: "20px", fontSize: "13px" }}>
            All clear ✓
          </div>
        )}
        {tasks.map(task => (
          <div key={task.id} style={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: "10px",
            padding: "10px 12px",
            border: "1px solid rgba(255,255,255,0.07)"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "13px", fontWeight: 600 }}>{task.title}</span>
              <span style={{
                fontSize: "10px",
                padding: "2px 8px",
                borderRadius: "999px",
                background: task.urgency === "critical" ? "#ef444422" : task.urgency === "medium" ? "#f59e0b22" : "#22c55e22",
                color: task.urgency === "critical" ? "#ef4444" : task.urgency === "medium" ? "#f59e0b" : "#22c55e",
                border: `1px solid ${task.urgency === "critical" ? "#ef444444" : task.urgency === "medium" ? "#f59e0b44" : "#22c55e44"}`
              }}>
                {task.urgency}
              </span>
            </div>
            {task.due_time && (
              <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", marginTop: "4px" }}>
                📅 {task.due_time}
              </div>
            )}
            <button
              onClick={() => handleDone(task.id!)}
              style={{
                marginTop: "8px",
                width: "100%",
                padding: "5px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.6)",
                fontSize: "11px",
                cursor: "pointer"
              }}
            >
              ✓ Done
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
