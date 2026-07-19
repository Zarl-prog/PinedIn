import { Lightning } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";

export default function QuickAdd() {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input immediately on mount
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Close on blur — user clicked away
    const handleBlur = () => {
      setTimeout(() => getCurrentWindow().close(), 100);
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  useEffect(() => {
    // Close on Escape
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") getCurrentWindow().close();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  async function handleSubmit() {
    const title = value.trim();
    if (!title || saving) return;

    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      await invoke("quick_add_task", {
        title,
        dueDate: today,
      });
      await getCurrentWindow().close();
    } catch (err) {
      console.error("Quick add failed:", err);
      setSaving(false);
    }
  }

  return (
    <div
      style={{
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
        boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
      }}
    >
      {/* Icon */}
      <Lightning size={15} weight="light" color="#444" style={{ flexShrink: 0 }} />

      {/* Input */}
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        placeholder="Task name..."
        disabled={saving}
        style={{
          flex: 1,
          background: "transparent",
          border: "none",
          outline: "none",
          color: saving ? "#666" : "#ffffff",
          fontSize: "14px",
          fontFamily: "'Geist Mono', monospace",
          caretColor: "#ffffff",
          minWidth: 0,
        }}
      />

      {/* Right hint */}
      <span
        style={{
          fontSize: "11px",
          color: "#333",
          fontFamily: "'Geist Mono', monospace",
          flexShrink: 0,
          whiteSpace: "nowrap",
        }}
      >
        {saving ? "Adding..." : "esc to close"}
      </span>
    </div>
  );
}
