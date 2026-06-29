import React from "react";
import ReactDOM from "react-dom/client";
import TaskCard from "./components/TaskCard";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./task-card.css";

let systemMediaListener: (() => void) | null = null;

function stopSystemTheme() {
  if (systemMediaListener) {
    systemMediaListener();
    systemMediaListener = null;
  }
}

function listenSystemTheme() {
  stopSystemTheme();
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = (e: MediaQueryListEvent) => {
    document.documentElement.classList.toggle("dark", e.matches);
  };
  mq.addEventListener("change", handler);
  systemMediaListener = () => mq.removeEventListener("change", handler);
}

function applyTheme(theme: string) {
  const root = document.documentElement;
  root.removeAttribute("data-theme");
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else if (theme === "parchment") {
    root.classList.remove("dark");
    root.setAttribute("data-theme", "parchment");
  } else {
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

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
  document.addEventListener("contextmenu", (e) => e.preventDefault());

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
    document.getElementById("root")!.innerHTML = `<div style="color:var(--text-primary-card);padding:20px">Invalid task</div>`;
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
    document.getElementById("root")!.innerHTML = `<div style="color:var(--text-primary-card);padding:20px">Failed to load task</div>`;
  }
}

main();
