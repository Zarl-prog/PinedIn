import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";

type TooltipContent = { title: string; description?: string };

export default function TooltipPopup() {
  const [content, setContent] = useState<TooltipContent | null>(null);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    listen<TooltipContent>("tooltip-content", (e) => {
      setContent(e.payload);
    }).then((u) => {
      unlisten = u;
    });
    invoke<TooltipContent | null>("get_tooltip_content")
      .then((c) => {
        if (c) setContent(c);
      })
      .catch(() => {});
    return () => {
      unlisten?.();
    };
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, padding: 0 }}>
      {content && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            background: "var(--pill-bg, #0A0A0A)",
            border: "1px solid var(--border-card, #1A1A1A)",
            borderRadius: "8px",
            padding: "8px 10px",
            whiteSpace: "pre-wrap",
            width: "max-content",
            maxWidth: "100%",
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
            {content.title}
          </div>
          {content.description && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--text-muted-card, #999)",
                lineHeight: 1.4,
                marginTop: "4px",
              }}
            >
              {content.description}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
