import { PencilSimpleLine, X } from "@phosphor-icons/react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useReminderStore } from "@/store/reminderStore";

const DEFAULT_W = 122;
const DEFAULT_H = 110;
const MIN_W = 120;
const MIN_H = 100;
const MAX_W = 220;
const MAX_H = 190;

const HANDLES = [
  "top-left",
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
];
const HANDLE_POS: Record<
  string,
  { top?: string; left?: string; right?: string; bottom?: string; cursor: string }
> = {
  "top-left": { top: "-6px", left: "-6px", cursor: "nwse-resize" },
  top: { top: "-4px", left: "0", cursor: "ns-resize" },
  "top-right": { top: "-6px", right: "-6px", cursor: "nesw-resize" },
  right: { right: "-4px", top: "0", cursor: "ew-resize" },
  "bottom-right": { bottom: "-6px", right: "-6px", cursor: "nwse-resize" },
  bottom: { bottom: "-4px", left: "0", cursor: "ns-resize" },
  "bottom-left": { bottom: "-6px", left: "-6px", cursor: "nesw-resize" },
  left: { left: "-4px", top: "0", cursor: "ew-resize" },
};

export default function CustomizeCardModal() {
  const open = useReminderStore((s) => s.isCustomizeOpen);
  const setOpen = useReminderStore.getState().setCustomizeOpen;

  const [w, setW] = useState(DEFAULT_W);
  const [h, setH] = useState(DEFAULT_H);
  const [saved, setSaved] = useState(false);
  const dragging = useRef<string | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, sw: 0, sh: 0 });

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    dragging.current = null;
    invoke<Record<string, string>>("get_settings_map")
      .then((map) => {
        setW(map.custom_card_width ? parseInt(map.custom_card_width) : DEFAULT_W);
        setH(map.custom_card_height ? parseInt(map.custom_card_height) : DEFAULT_H);
      })
      .catch(() => {});
  }, [open]);

  const handleMouseDown = useCallback(
    (handle: string, e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      dragging.current = handle;
      dragStart.current = { mx: e.clientX, my: e.clientY, sw: w, sh: h };

      const onMove = (me: MouseEvent) => {
        const { mx, my, sw, sh } = dragStart.current;
        const dx = me.clientX - mx;
        const dy = me.clientY - my;

        let newW = sw,
          newH = sh;
        if (handle.includes("right")) newW = Math.max(MIN_W, Math.min(MAX_W, sw + dx));
        if (handle.includes("left")) newW = Math.max(MIN_W, Math.min(MAX_W, sw - dx));
        if (handle.includes("bottom")) newH = Math.max(MIN_H, Math.min(MAX_H, sh + dy));
        if (handle.includes("top")) newH = Math.max(MIN_H, Math.min(MAX_H, sh - dy));

        setW(newW);
        setH(newH);
      };

      const onUp = () => {
        dragging.current = null;
        cleanup();
      };

      const cleanup = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [w, h],
  );

  const handleSave = async () => {
    await invoke("update_setting", { key: "custom_card_width", value: String(w) });
    await invoke("update_setting", { key: "custom_card_height", value: String(h) });
    await emit("customize-card-size", { width: w, height: h });
    setSaved(true);
    setTimeout(() => setOpen(false), 800);
  };

  const handleReset = async () => {
    setW(DEFAULT_W);
    setH(DEFAULT_H);
    await invoke("update_setting", { key: "custom_card_width", value: String(DEFAULT_W) });
    await invoke("update_setting", { key: "custom_card_height", value: String(DEFAULT_H) });
    await emit("customize-card-size", { width: DEFAULT_W, height: DEFAULT_H });
    setSaved(true);
    setTimeout(() => setOpen(false), 800);
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ position: "absolute", inset: 0, background: "var(--bg-overlay)" }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: "480px",
              background: "var(--bg-modal)",
              border: "1px solid var(--border)",
              borderRadius: "10px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "17px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                }}
              >
                <PencilSimpleLine size={20} weight="light" /> Customize your tasks
              </span>
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-light)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-badge)";
                  e.currentTarget.style.color = "var(--text-primary)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                }}
              >
                <X size={16} weight="light" />
              </button>
            </div>

            <p
              style={{
                fontSize: "13px",
                color: "var(--text-muted)",
                marginBottom: "16px",
                textAlign: "center",
              }}
            >
              Drag the edges of the card below to set your preferred task card size
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "220px",
              }}
            >
              <div
                style={{
                  position: "relative",
                  width: `${w}px`,
                  height: `${h}px`,
                  background: "var(--card-bg, #0f0f11)",
                  border: "5px solid var(--card-border, rgba(255,255,255,0.15))",
                  borderRadius: "16px",
                  transition: dragging.current ? "none" : "width 0.1s ease, height 0.1s ease",
                }}
              >
                {HANDLES.map((hnd) => {
                  const pos = HANDLE_POS[hnd];
                  const isEdge =
                    hnd === "top" || hnd === "bottom" || hnd === "left" || hnd === "right";
                  const size = isEdge
                    ? {
                        width: hnd === "left" || hnd === "right" ? "8px" : "100%",
                        height: hnd === "top" || hnd === "bottom" ? "8px" : "100%",
                      }
                    : { width: "12px", height: "12px" };
                  return (
                    <div
                      key={hnd}
                      onMouseDown={(e) => handleMouseDown(hnd, e)}
                      style={{
                        position: "absolute",
                        zIndex: 10,
                        ...pos,
                        ...size,
                        cursor: pos.cursor,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <div
              style={{
                textAlign: "center",
                marginTop: "12px",
                fontSize: "13px",
                color: "var(--text-muted)",
              }}
            >
              {w} × {h} px
            </div>

            {saved && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: "6px",
                  fontSize: "13px",
                  color: "var(--text-success, #4ade80)",
                  fontWeight: 500,
                }}
              >
                Size saved!
              </div>
            )}

            <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
              <button
                onClick={handleReset}
                className="feature-btn"
                style={{ flex: 1, padding: "8px 0", borderRadius: "8px", fontSize: "14px" }}
              >
                Reset to default
              </button>
              <button
                onClick={handleSave}
                className="feature-btn primary"
                style={{ flex: 1, padding: "8px 0", borderRadius: "8px", fontSize: "14px" }}
              >
                Save size
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
