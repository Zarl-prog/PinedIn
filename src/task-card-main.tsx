import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import React from "react";
import ReactDOM from "react-dom/client";
import type { Task } from "@/lib/tauriCommands";
import { applyTheme, listenSystemTheme, stopSystemTheme } from "@/lib/theme";
import ErrorBoundary from "./components/ErrorBoundary";
import TaskCard from "./components/TaskCard";
import "./task-card.css";

async function main() {
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.body.classList.add("task-card-view");

  try {
    const settings = await invoke<{ theme: string }>("get_settings");
    stopSystemTheme();
    applyTheme(settings.theme);
    if (settings.theme === "system") listenSystemTheme();
  } catch (_) {}
  listen<string>("theme_changed", (e) => {
    stopSystemTheme();
    applyTheme(e.payload);
    if (e.payload === "system") listenSystemTheme();
  });

  // Parse task ID from window label (format: "task_{id}")
  const label = getCurrentWindow().label;
  const taskId = parseInt(label.replace("task_", ""), 10);

  if (isNaN(taskId)) {
    document.getElementById("root")!.innerHTML =
      `<div style="color:var(--text-primary-card);padding:20px">Invalid task</div>`;
    return;
  }

  try {
    const task = await invoke<Task>("get_task_by_id", { id: taskId });

    ReactDOM.createRoot(document.getElementById("root")!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <TaskCard
            taskId={taskId}
            title={task.title}
            description={task.description}
            dueTime={task.due_time}
            createdAt={task.created_at}
            recurrence={task.recurrence}
            tags={task.tags}
            timeLimitMinutes={task.time_limit_minutes}
            startedAt={task.started_at}
          />
        </ErrorBoundary>
      </React.StrictMode>,
    );
  } catch (err) {
    document.getElementById("root")!.innerHTML =
      `<div style="color:var(--text-primary-card);padding:20px">Failed to load task</div>`;
  }
}

main();
