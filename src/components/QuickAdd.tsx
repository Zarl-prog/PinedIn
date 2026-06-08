import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../lib/tauriCommands";
import { localDateStr } from "../lib/utils";

export default function QuickAdd() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") getCurrentWindow().close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  async function handleSubmit() {
    const title = value.trim();
    if (!title || status === "loading") return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const today = localDateStr();
      await invoke<Task>("create_task", {
        title,
        description: "",
        urgency: "critical",
        dueTime: today,
        recurrence: null,
        tags: null,
        timeLimitMinutes: null,
      });
      getCurrentWindow().close();
    } catch (e) {
      console.error("[QuickAdd] create_task failed:", e);
      setStatus("error");
      setErrorMsg(typeof e === "string" ? e : String(e));
      inputRef.current?.focus();
    }
  }

  const accent = status === "error" ? "#ff5555" : "#333";

  return (
    <div
      style={{
        width: "480px",
        height: "64px",
        background: "var(--bg-app)",
        border: `1px solid ${status === "error" ? "#ff5555" : "var(--border-light)"}`,
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
        gap: "12px",
      }}
    >
      <span style={{ color: accent, fontSize: "16px" }}>+</span>
      <input
        ref={inputRef}
        value={value}
        disabled={status === "loading"}
        onChange={(e) => {
          setValue(e.target.value);
          if (status === "error") setStatus("idle");
        }}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder={
          status === "error"
            ? errorMsg || "Failed — try again"
            : "Task name — Enter to add as Critical due today..."
        }
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          color: status === "error" ? "#ff5555" : "var(--text-primary)",
          fontSize: "14px",
          fontFamily: "'Geist Mono', monospace",
          caretColor: "#ffffff",
        }}
      />
      <span style={{ fontSize: "11px", color: accent }}>
        {status === "loading" ? "..." : "esc to close"}
      </span>
    </div>
  );
}
