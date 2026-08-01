import { invoke } from "@tauri-apps/api/core";
import { currentMonitor, getCurrentWindow } from "@tauri-apps/api/window";
import { useLayoutEffect, useRef } from "react";

const GAP = 6;

// Renders nothing in this window. Instead it measures the tooltip content in
// a hidden div and opens the shared, fully click-through tooltip popup
// (window label "tooltip") positioned at the anchor's screen coordinates.
// Keeping the tooltip in its own window means the owner never has to grow to
// fit it — growing used to leave transparent click-blocking margins around
// the pill / edge-peek strip.
export default function SmartTooltip({
  anchorEl,
  title,
  description,
}: {
  anchorEl: HTMLElement | null;
  title: string;
  description?: string;
}) {
  const measureRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = measureRef.current;
    const anchor = anchorEl;
    if (!el || !anchor) return;

    const tRect = el.getBoundingClientRect();
    const tw = Math.ceil(tRect.width);
    const th = Math.ceil(tRect.height);
    const aRect = anchor.getBoundingClientRect();
    let cancelled = false;

    (async () => {
      const win = getCurrentWindow();
      const [outer, scale, monitor] = await Promise.all([
        win.outerPosition(),
        win.scaleFactor(),
        currentMonitor(),
      ]);

      const mLeft = monitor ? monitor.position.x / monitor.scaleFactor : 0;
      const mRight = mLeft + (monitor ? monitor.size.width / monitor.scaleFactor : 1920);
      const mTop = monitor ? monitor.position.y / monitor.scaleFactor : 0;
      const mBottom = mTop + (monitor ? monitor.size.height / monitor.scaleFactor : 1080);

      const anchorLeft = outer.x / scale + aRect.left;
      const anchorTop = outer.y / scale + aRect.top;

      let top = anchorTop + aRect.height + GAP;
      if (top + th > mBottom) top = anchorTop - th - GAP;
      top = Math.max(mTop + GAP, top);

      let left = anchorLeft;
      if (left + tw > mRight) left = mRight - tw - GAP;
      left = Math.max(mLeft + GAP, left);

      if (cancelled) return;
      await invoke("show_tooltip", {
        x: left,
        y: top,
        width: tw,
        height: th,
        title,
        description,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [anchorEl, title, description]);

  // Only the final unmount should dismiss the popup — re-runs of the layout
  // effect above just reposition/re-content it.
  useLayoutEffect(() => {
    return () => {
      invoke("hide_tooltip").catch(() => {});
    };
  }, []);

  return (
    <div
      ref={measureRef}
      style={{
        position: "fixed",
        top: -9999,
        left: -9999,
        visibility: "hidden",
        background: "var(--pill-bg, #0A0A0A)",
        border: "1px solid var(--border-card, #1A1A1A)",
        borderRadius: "8px",
        padding: "8px 10px",
        minWidth: "160px",
        maxWidth: "260px",
        whiteSpace: "pre-wrap",
        zIndex: -1,
      }}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: "var(--text-primary-card, #fff)",
          lineHeight: 1.3,
        }}
      >
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted-card, #999)",
            lineHeight: 1.4,
            marginTop: "4px",
          }}
        >
          {description}
        </div>
      )}
    </div>
  );
}
