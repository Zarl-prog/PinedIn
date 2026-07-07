import { useState, useEffect, useRef, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { Plus } from "@phosphor-icons/react";

export default function QuickAdd() {
  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const didDrag = useRef(false);
  const mouseDownPos = useRef({ x: 0, y: 0 });

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

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("input")) return;
    didDrag.current = false;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    let dragInitiated = false;
    const cleanup = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    const onMove = async (me: MouseEvent) => {
      const dx = Math.abs(me.clientX - mouseDownPos.current.x);
      const dy = Math.abs(me.clientY - mouseDownPos.current.y);
      if ((dx > 6 || dy > 6) && !dragInitiated) {
        dragInitiated = true;
        didDrag.current = true;
        try { await getCurrentWindow().startDragging(); }
        catch { didDrag.current = false; }
        finally { cleanup(); }
      }
    };
    const onUp = () => cleanup();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
    <div onMouseDown={handleMouseDown} className="quick-add-container" style={{
      width: "480px",
      height: "65px",
      maxHeight: "65px",
      background: "#000000",
      border: "1px solid #2a2a2a",
      borderRadius: "14px",
      display: "flex",
      alignItems: "center",
      gap: "12px",
      padding: "0 18px",
      overflow: "hidden",
      boxSizing: "border-box"
    }}>
      <Plus
        size={15}
        weight="light"
        color="#888"
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
