import React from "react";
import ReactDOM from "react-dom/client";
import CompactPill from "./components/CompactPill";
import ErrorBoundary from "./components/ErrorBoundary";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { applyTheme, listenSystemTheme, stopSystemTheme } from "@/lib/theme";
import "./task-card.css";

(async () => {
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

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <CompactPill />
      </ErrorBoundary>
    </React.StrictMode>,
  );
})();
