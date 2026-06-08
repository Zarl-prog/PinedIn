import React from "react";
import ReactDOM from "react-dom/client";
import QuickAdd from "./components/QuickAdd";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
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
  try {
    const settings = await invoke<{ theme: string }>("get_settings");
    applyTheme(settings.theme);
    if (settings.theme === "system") {
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        document.documentElement.classList.toggle("dark", e.matches);
      });
    }
  } catch (_) {}
  listen<string>("theme_changed", (e) => applyTheme(e.payload));

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QuickAdd />
    </React.StrictMode>
  );
})();
