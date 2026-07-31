import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import React from "react";
import ReactDOM from "react-dom/client";
import { applyTheme, listenSystemTheme, stopSystemTheme } from "@/lib/theme";
import QuickAdd from "./components/QuickAdd";

(async () => {
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
      <QuickAdd />
    </React.StrictMode>,
  );
})();
