import React from "react";
import ReactDOM from "react-dom/client";
import CompactPill from "./components/CompactPill";
import ErrorBoundary from "./components/ErrorBoundary";
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
    </React.StrictMode>
  );
})();