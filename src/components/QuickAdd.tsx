import { useState, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Lightning } from "@phosphor-icons/react";

export default function QuickAdd() {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") getCurrentWindow().close();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleBlur() {
      getCurrentWindow().close();
    }
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  async function handleSubmit() {
    const title = value.trim();
    if (!title || submitting) return;

    setSubmitting(true);
    const today = new Date().toISOString().split("T")[0];

    try {
      await invoke("quick_add_task", { title, dueDate: today });
      await getCurrentWindow().close();
    } catch (err) {
      console.error("Quick add failed:", err);
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      width: "480px",
      height: "64px",
      maxHeight: "64px",
      background: "#000000",
      border: "1px solid #2a2a2a",
      borderRadius: "14px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "0 18px",
      overflow: "hidden",
      boxSizing: "border-box",
      boxShadow: "0 8px 32px rgba(0,0,0,0.8)"
    }}>
      <Lightning
        size={15}
        weight="light"
        color="#333"
        style={{ flexShrink: 0 }}
      />

      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => e.key === "Enter" && handleSubmit()}
        placeholder="Task name..."
        disabled={submitting}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          color: "#ffffff",
          fontSize: "14px",
          fontFamily: "'Geist Mono', monospace",
          caretColor: "#ffffff",
          minWidth: 0
        }}
      />

      <span style={{
        fontSize: "11px",
        color: "#333",
        flexShrink: 0,
        fontFamily: "'Geist Mono', monospace",
        whiteSpace: "nowrap"
      }}>
        {submitting ? "Adding..." : "esc to close"}
      </span>
    </div>
  );
}
