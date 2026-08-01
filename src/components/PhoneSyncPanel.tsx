import { CheckCircle, DeviceMobile, X } from "@phosphor-icons/react";
import { listen } from "@tauri-apps/api/event";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  cancelPhoneSync,
  startPhoneSync,
  type PairingPayload,
} from "@/lib/tauriCommands";
import { useReminderStore } from "@/store/reminderStore";

interface PhoneSyncPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * The pairing dialog for the Android companion app.
 *
 * One dialog, one sync. Opening it mints a short-lived code and binds a listener
 * on the local network; scanning the QR pushes the phone's captures straight
 * here. Closing it — or letting the code run out — tears both down, so nothing
 * is left listening once the dialog is gone.
 */
export default function PhoneSyncPanel({ open, onClose }: PhoneSyncPanelProps) {
  const [pairing, setPairing] = useState<PairingPayload | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [received, setReceived] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useReminderStore.getState().fetchTasks;

  // `open` is read inside the unmount cleanup below; a ref keeps that cleanup
  // out of the effect's dependency list so the listeners aren't rebound on
  // every state change.
  const openRef = useRef(open);
  openRef.current = open;

  const mint = useCallback(async () => {
    setError(null);
    setReceived(null);
    try {
      const payload = await startPhoneSync();
      setPairing(payload);
      setSecondsLeft(payload.expires_in_secs);
    } catch (e) {
      setPairing(null);
      setSecondsLeft(0);
      setError(String(e));
    }
  }, []);

  // Mint a fresh code each time the dialog opens, and hand the listener back
  // when it closes.
  useEffect(() => {
    if (open) {
      void mint();
    } else {
      setPairing(null);
      setReceived(null);
      setError(null);
      setSecondsLeft(0);
      void cancelPhoneSync().catch(() => {});
    }
  }, [open, mint]);

  // Close the listener if the whole window goes away with the dialog still up.
  useEffect(() => {
    return () => {
      if (openRef.current) void cancelPhoneSync().catch(() => {});
    };
  }, []);

  // Countdown. At zero the desktop will reject the code anyway, so release the
  // port rather than sitting bound for a code nobody can use.
  useEffect(() => {
    if (!open || !pairing || received !== null || secondsLeft <= 0) return;
    const t = setTimeout(() => {
      const next = secondsLeft - 1;
      setSecondsLeft(next);
      // Side effect kept out of the state updater — under StrictMode an updater
      // can run twice, and cancelling twice would be a wasted round trip.
      if (next <= 0) void cancelPhoneSync().catch(() => {});
    }, 1000);
    return () => clearTimeout(t);
  }, [open, pairing, received, secondsLeft]);

  useEffect(() => {
    if (!open) return;
    const unlisten = Promise.all([
      listen<number>("phone_sync_received", (event) => {
        setReceived(event.payload);
        setError(null);
        void fetchTasks();
      }),
      listen<string>("phone_sync_error", (event) => {
        setError(event.payload);
      }),
    ]);
    return () => {
      void unlisten.then((fns) => fns.forEach((fn) => fn()));
    };
  }, [open, fetchTasks]);

  const expired = pairing !== null && secondsLeft <= 0 && received === null;

  return (
    <AnimatePresence>
      {open && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
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
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: "380px",
              background: "var(--bg-modal)",
              border: "1px solid var(--border)",
              borderRadius: "14px",
              boxShadow: "var(--shadow-menu)",
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
                  fontSize: "17px",
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <DeviceMobile size={18} weight="light" />
                Sync Phone
              </span>
              <button
                onClick={onClose}
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
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "var(--bg-badge)";
                  e.currentTarget.style.color = "var(--text-primary)";
                  e.currentTarget.style.borderColor = "var(--text-muted)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-secondary)";
                  e.currentTarget.style.borderColor = "var(--border-light)";
                }}
              >
                <X size={16} weight="light" />
              </button>
            </div>

            {received !== null ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  padding: "28px 0 20px",
                  textAlign: "center",
                }}
              >
                <CheckCircle size={40} weight="light" color="#22c55e" />
                <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>
                  {received === 0
                    ? "Nothing new to add"
                    : `${received} ${received === 1 ? "task" : "tasks"} landed`}
                </span>
                <span
                  style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.5 }}
                >
                  {received === 0
                    ? "Those captures were already on this machine."
                    : "They're on your desktop now. The listener has closed."}
                </span>
              </div>
            ) : error ? (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  padding: "8px 0",
                }}
              >
                <span
                  style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.6 }}
                >
                  {error}
                </span>
                <button
                  onClick={() => void mint()}
                  style={{
                    background: "var(--bg-badge)",
                    border: "1px solid var(--border)",
                    color: "var(--text-primary)",
                    borderRadius: "6px",
                    padding: "8px 16px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Geist Mono', monospace",
                  }}
                >
                  Try again
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div
                  style={{
                    position: "relative",
                    alignSelf: "center",
                    width: "240px",
                    height: "240px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#ffffff",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                  }}
                >
                  {pairing ? (
                    <div
                      style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", opacity: expired ? 0.15 : 1 }}
                      // The SVG is generated locally by the `qrcode` crate from
                      // our own address and token — no external input reaches it.
                      dangerouslySetInnerHTML={{ __html: pairing.svg.replace('<svg ', '<svg style="width:100%;height:100%" ') }}
                    />
                  ) : (
                    <span style={{ fontSize: "12px", color: "#888" }}>Generating…</span>
                  )}
                  {expired && (
                    <button
                      onClick={() => void mint()}
                      style={{
                        position: "absolute",
                        background: "#111",
                        color: "#fff",
                        border: "none",
                        borderRadius: "6px",
                        padding: "9px 18px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'Geist Mono', monospace",
                      }}
                    >
                      Code expired — new code
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "10px 14px",
                  }}
                >
                  <code
                    style={{
                      fontSize: "12px",
                      color: "var(--text-primary)",
                      fontFamily: "'Geist Mono', monospace",
                    }}
                  >
                    {pairing ? `${pairing.host}:${pairing.port}` : "—"}
                  </code>
                  <span
                    style={{
                      fontSize: "12px",
                      fontFamily: "'Geist Mono', monospace",
                      fontWeight: 600,
                      color: expired
                        ? "var(--text-muted)"
                        : secondsLeft <= 15
                          ? "#f59e0b"
                          : "var(--text-secondary)",
                    }}
                  >
                    {expired ? "expired" : `${secondsLeft}s left`}
                  </span>
                </div>

                <p
                  style={{
                    margin: 0,
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    lineHeight: 1.6,
                    textAlign: "center",
                  }}
                >
                  Open Pinned on your phone, tap <strong>Scan</strong>, and point it here. Both
                  devices need to be on the same WiFi — nothing goes to the internet.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
