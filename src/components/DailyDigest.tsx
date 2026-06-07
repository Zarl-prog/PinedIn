import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

interface DigestData {
  overdue: number;
  due_today: number;
  unfinished_yesterday: number;
  total_active: number;
}

export default function DailyDigest() {
  const [data, setData] = useState<DigestData | null>(null);
  const [visible, setVisible] = useState(true);
  const [countdown, setCountdown] = useState(10);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    invoke<DigestData>("get_daily_digest").then(setData);
  }, []);

  // Countdown timer — starts only after the digest data has arrived
  // (otherwise a slow backend leaves the user staring at "Loading..."
  // for the whole 10 seconds) and stops the moment the user dismisses
  // (otherwise the next tick calls getCurrentWindow().close() on a
  // window that's already gone).
  useEffect(() => {
    if (!data) return;
    if (dismissed) return;
    const interval = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          handleDismiss();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // handleDismiss is stable enough — it only reads state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, dismissed]);

  async function handleDismiss() {
    if (dismissed) return;
    setDismissed(true);
    setVisible(false);
    await new Promise(r => setTimeout(r, 300));
    await getCurrentWindow().close();
  }

  function getMessage() {
    if (!data) return "Loading...";
    const parts = [];
    if (data.unfinished_yesterday > 0)
      parts.push(`${data.unfinished_yesterday} unfinished from yesterday`);
    if (data.overdue > 0)
      parts.push(`${data.overdue} overdue`);
    if (data.due_today > 0)
      parts.push(`${data.due_today} due today`);
    if (parts.length === 0)
      return "You're all caught up. Great start to the day.";
    return parts.join(", ") + ".";
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          style={{
            width: "420px",
            height: "220px",
            background: "#000",
            border: "1px solid #222",
            borderRadius: "12px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between"
          }}
        >
          {/* Header */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span style={{ fontSize: "11px", color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Daily Digest
              </span>
              <span style={{ fontSize: "11px", color: "#333" }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>

            {/* Message */}
            <p style={{ fontSize: "15px", color: "#ffffff", fontWeight: 600, lineHeight: 1.5 }}>
              {getMessage()}
            </p>

            {/* Stats row */}
            {data && (
              <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "#ffffff" }}>{data.total_active}</div>
                  <div style={{ fontSize: "10px", color: "#444" }}>Active</div>
                </div>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: data.due_today > 0 ? "#ffffff" : "#333" }}>{data.due_today}</div>
                  <div style={{ fontSize: "10px", color: "#444" }}>Due Today</div>
                </div>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: data.overdue > 0 ? "#ffffff" : "#333" }}>{data.overdue}</div>
                  <div style={{ fontSize: "10px", color: "#444" }}>Overdue</div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* Progress bar countdown */}
            <div style={{ flex: 1, height: "1px", background: "#1a1a1a", borderRadius: "99px", marginRight: "16px", overflow: "hidden" }}>
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 10, ease: "linear" }}
                style={{ height: "100%", background: "#ffffff" }}
              />
            </div>
            <button
              onClick={handleDismiss}
              style={{
                background: "transparent",
                border: "1px solid #222",
                borderRadius: "6px",
                padding: "5px 12px",
                color: "#666",
                fontSize: "11px",
                cursor: "pointer",
                fontFamily: "'Geist Mono', monospace"
              }}
            >
              Dismiss {countdown}s
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
