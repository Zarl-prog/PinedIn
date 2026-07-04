import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import Skeleton from "./ui/Skeleton";

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
    invoke<DigestData>("get_daily_digest").then(setData).catch(() => setData({ overdue: 0, due_today: 0, unfinished_yesterday: 0, total_active: 0 }));
  }, []);

  // Countdown timer. Starts immediately so the window always
  // auto-dismisses even if the backend invoke fails.
  useEffect(() => {
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
  }, [dismissed]);

  async function handleDismiss() {
    if (dismissed) return;
    setDismissed(true);
    setVisible(false);
    await new Promise(r => setTimeout(r, 300));
    await getCurrentWindow().close().catch(() => {});
  }

  function getMessage() {
    if (!data) return "";
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
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
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
                <span style={{ fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Daily Digest
              </span>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </span>
            </div>

            {/* Message */}
            <p style={{ fontSize: "15px", color: "var(--text-primary)", fontWeight: 600, lineHeight: 1.5 }}>
              {data ? getMessage() : <Skeleton width="70%" height={16} />}
            </p>

            {/* Stats row */}
            {data ? (
              <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{data.total_active}</div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Active</div>
                </div>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: data.due_today > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{data.due_today}</div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Due Today</div>
                </div>
                <div>
                  <div style={{ fontSize: "20px", fontWeight: 700, color: data.overdue > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{data.overdue}</div>
                  <div style={{ fontSize: "10px", color: "var(--text-muted)" }}>Overdue</div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "16px", marginTop: "16px" }}>
                <div>
                  <Skeleton width={28} height={28} borderRadius={4} />
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>Active</div>
                </div>
                <div>
                  <Skeleton width={28} height={28} borderRadius={4} />
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>Due Today</div>
                </div>
                <div>
                  <Skeleton width={28} height={28} borderRadius={4} />
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>Overdue</div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* Progress bar countdown */}
            <div style={{ flex: 1, height: "1px", background: "var(--divider)", borderRadius: "99px", marginRight: "16px", overflow: "hidden" }}>
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 10, ease: "linear" }}
                style={{ height: "100%", background: "var(--text-primary)" }}
              />
            </div>
            <button
              onClick={handleDismiss}
              className="feature-btn"
              style={{ padding: "5px 12px" }}
            >
              Dismiss {countdown}s
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
