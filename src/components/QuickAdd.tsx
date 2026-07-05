import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import type { Task } from "../lib/tauriCommands";
import { localDateStr } from "../lib/utils";
import { Plus, DotsThree } from "@phosphor-icons/react";
import "../index.css";

export default function QuickAdd() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isSubmitting = useRef(false);

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
    if (!title || isSubmitting.current) return;
    isSubmitting.current = true;

    setStatus("loading");
    setErrorMsg("");

    try {
      const today = localDateStr();
      await invoke<Task>("create_task", {
        title,
        description: "",
        dueTime: today,
        recurrence: null,
        tags: null,
        timeLimitMinutes: null,
        workspaceId: null,
      });
      getCurrentWindow().close();
    } catch (e) {
      console.error("[QuickAdd] create_task failed:", e);
      setStatus("error");
      setErrorMsg(typeof e === "string" ? e : String(e));
      inputRef.current?.focus();
    }
  }

  const accent = status === "error" ? "var(--text-danger)" : "var(--text-muted)";

  return (
    <div
      style={{
        width: "480px",
        height: "64px",
        maxHeight: "64px",
        overflow: "hidden",
        background: "#000000",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "0 16px",
        border: `1px solid ${status === "error" ? "var(--text-danger)" : "#222"}`,
        borderRadius: "12px",
        boxSizing: "border-box",
      }}
    >
      <Plus size={16} weight="light" color={accent} />
      <input
        ref={inputRef}
        value={value}
        disabled={status === "loading"}
        onChange={(e) => {
          setValue(e.target.value);
          if (status === "error") setStatus("idle");
        }}
        maxLength={500}
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
          color: status === "error" ? "var(--text-danger)" : "var(--text-primary)",
          fontSize: "14px",
          fontFamily: "'Geist Mono', monospace",
          caretColor: "var(--text-primary)",
        }}
      />
      <span style={{ fontSize: "11px", color: accent, display: "flex", alignItems: "center", gap: "4px" }}>
        {status === "loading" ? <DotsThree size={14} weight="light" /> : "esc to close"}
      </span>
    </div>
  );
}
