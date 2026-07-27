import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const GAP = 6;

export default function SmartTooltip({
  anchorEl,
  title,
  description,
}: {
  anchorEl: HTMLElement | null;
  title: string;
  description?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const anchor = anchorEl;
    if (!el || !anchor) {
      setPos(null);
      return;
    }

    const tRect = el.getBoundingClientRect();
    const aRect = anchor.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const tw = tRect.width;
    const th = tRect.height;

    let top: number;
    if (aRect.bottom + th + GAP <= vh) {
      top = aRect.bottom + GAP;
    } else if (aRect.top - th - GAP >= 0) {
      top = aRect.top - th - GAP;
    } else {
      top = GAP;
    }

    let left: number;
    if (aRect.left + tw + GAP <= vw) {
      left = aRect.left;
    } else if (aRect.right - tw - GAP >= 0) {
      left = aRect.right - tw;
    } else {
      left = Math.max(GAP, (vw - tw) / 2);
    }

    left = Math.max(GAP, Math.min(left, vw - tw - GAP));
    top = Math.max(GAP, Math.min(top, vh - th - GAP));

    setPos({ top, left });
  }, [anchorEl, title, description]);

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        background: "var(--pill-bg, #0A0A0A)",
        border: "1px solid var(--border-card, #1A1A1A)",
        borderRadius: "8px",
        padding: "8px 10px",
        zIndex: 9999,
        minWidth: "160px",
        maxWidth: "260px",
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
        opacity: pos ? 1 : 0,
        transition: "opacity 120ms ease",
      }}
    >
      <div style={{
        fontSize: "12px",
        fontWeight: 600,
        color: "var(--text-primary-card, #fff)",
        lineHeight: 1.3,
      }}>
        {title}
      </div>
      {description && (
        <div style={{
          fontSize: "11px",
          color: "var(--text-muted-card, #999)",
          lineHeight: 1.4,
          marginTop: "4px",
        }}>
          {description}
        </div>
      )}
    </div>,
    document.body,
  );
}
