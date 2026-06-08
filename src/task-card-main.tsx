import React from "react";
import ReactDOM from "react-dom/client";
import TaskCard from "./components/TaskCard";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import "./task-card.css";

interface TaskData {
  id?: number | null;
  title: string;
  description: string;
  urgency: string;
  due_time: string;
  completed: boolean;
  created_at: string;
  recurrence: string | null;
  tags: string | null;
  time_limit_minutes: number | null;
  started_at: string | null;
}

async function main() {
  // Parse task ID from window label (format: "task_{id}")
  const label = getCurrentWindow().label;
  const taskId = parseInt(label.replace("task_", ""), 10);

  if (isNaN(taskId)) {
    document.getElementById("root")!.innerHTML = `<div style="color:#fff;padding:20px">Invalid task</div>`;
    return;
  }

  try {
    const task = await invoke<TaskData>("get_task_by_id", { id: taskId });

    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <TaskCard
          taskId={taskId}
          title={task.title}
          description={task.description}
          urgency={task.urgency}
          dueTime={task.due_time}
          createdAt={task.created_at}
          recurrence={task.recurrence}
          tags={task.tags}
          timeLimitMinutes={task.time_limit_minutes}
          startedAt={task.started_at}
        />
      </React.StrictMode>
    );
  } catch (err) {
    document.getElementById("root")!.innerHTML = `<div style="color:#fff;padding:20px">Failed to load task</div>`;
  }
}

main();
