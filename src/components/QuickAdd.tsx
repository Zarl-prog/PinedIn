import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

export default function QuickAdd() {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input immediately on mount
    inputRef.current?.focus();

    // Close on Escape
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") getCurrentWindow().close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Close when focus leaves the window
  useEffect(() => {
    const handleBlur = () => getCurrentWindow().close();
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  async function handleSubmit() {
    const title = value.trim();
    if (!title) return;
    await invoke("create_task", {
      title,
      description: "",
      urgency: "medium",
      dueDate: "",
      recurrence: null,
      tags: null,
    });
    getCurrentWindow().close();
  }

  return (
    <div style={{
      width: "480px",
      height: "64px",
      background: "#000",
      border: "1px solid #222",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      gap: "12px"
    }}>
      <span style={{ color: "#333", fontSize: "16px" }}>+</span>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSubmit()}
        placeholder="Add a task and hit Enter..."
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "#ffffff",
          fontSize: "14px",
          fontFamily: "'Geist Mono', monospace",
          caretColor: "#ffffff"
        }}
      />
      <span style={{ fontSize: "11px", color: "#333" }}>esc to close</span>
    </div>
  );
}
