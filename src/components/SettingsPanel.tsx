import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/useSettings";
import {
  isAutostartEnabled,
  enableAutostart,
  disableAutostart,
  getShakeInterval,
  setShakeInterval,
} from "@/lib/tauriCommands";
import { checkAndInstall } from "@/lib/updater";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * SettingsPanel - Monochrome settings panel with theme pills and autostart toggle.
 * All styling uses the exact palette: #0a0a0a, #1a1a1a, #ededed, #fff, etc.
 */
export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, updateSetting } = useSettings();
  const [autostartOn, setAutostartOn] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    state: "idle" | "checking" | "available" | "none" | "error";
    version?: string;
    error?: string;
  }>({ state: "idle" });

  const [shakeInterval, setShakeIntervalLocal] = useState(30);
  const [customInput, setCustomInput] = useState("");
  const [savedFeedback, setSavedFeedback] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Load shake interval on mount
  useEffect(() => {
    if (open) {
      getShakeInterval().then(setShakeIntervalLocal).catch(() => {});
    }
  }, [open]);

  const handleShakeIntervalChange = useCallback(async (seconds: number) => {
    clearTimeout(savedTimerRef.current);
    setShakeIntervalLocal(seconds);
    setCustomInput("");
    try {
      await setShakeInterval(seconds);
      setSavedFeedback(true);
      savedTimerRef.current = setTimeout(() => setSavedFeedback(false), 1500);
    } catch {}
  }, []);

  const handleCustomSubmit = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const val = parseInt(customInput, 10);
      if (!isNaN(val) && val > 0 && val <= 86400) {
        handleShakeIntervalChange(val);
      }
    },
    [customInput, handleShakeIntervalChange],
  );

  const SHAKE_PRESETS = [10, 15, 30, 60, 120, 300];

  function formatPresetLabel(s: number): string {
    if (s < 60) return `${s}s`;
    return `${s / 60}m`;
  }

  // Load current autostart state on mount
  useEffect(() => {
    if (open) {
      isAutostartEnabled()
        .then(setAutostartOn)
        .catch(() => {});
    }
  }, [open]);

  const handleCheckUpdates = async () => {
    setUpdateStatus({ state: "checking" });
    try {
      const result = await checkAndInstall();
      if (result.installed) {
        setUpdateStatus({ state: "idle" });
      } else if (result.available) {
        setUpdateStatus({
          state: "available",
          version: result.version,
        });
      } else {
        setUpdateStatus({ state: "none" });
      }
    } catch (err) {
      setUpdateStatus({
        state: "error",
        error: err instanceof Error ? err.message : "Update check failed",
      });
    }
  };

  const handleAutostartToggle = async () => {
    setAutostartLoading(true);
    try {
      if (autostartOn) {
        await disableAutostart();
        setAutostartOn(false);
      } else {
        await enableAutostart();
        setAutostartOn(true);
      }
    } catch (err) {
      console.error("Failed to toggle autostart:", err);
    } finally {
      setAutostartLoading(false);
    }
  };

  const handleThemeChange = async (theme: string) => {
    await updateSetting("theme", theme);
  };

  const themeOptions = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];

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
          }}
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.6)",
            }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "relative",
              zIndex: 10,
              width: "100%",
              maxWidth: "420px",
              background: "#0a0a0a",
              border: "1px solid #1a1a1a",
              borderRadius: "10px",
              padding: "24px",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
              }}
            >
              <span style={{ fontSize: "17px", fontWeight: 600, color: "#ededed" }}>
                Settings
              </span>
              <button
                onClick={onClose}
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "8px",
                  border: "1px solid #222",
                  background: "transparent",
                  color: "#666",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "15px",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#111";
                  e.currentTarget.style.color = "#fff";
                  e.currentTarget.style.borderColor = "#444";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "#666";
                  e.currentTarget.style.borderColor = "#222";
                }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Launch at login */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#888",
                    marginBottom: "8px",
                  }}
                >
                  Launch at login
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#0a0a0a",
                    border: "1px solid #1a1a1a",
                    borderRadius: "8px",
                    padding: "14px 16px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#ededed",
                      }}
                    >
                      {autostartOn ? "Enabled" : "Disabled"}
                    </span>
                    <span
                      style={{
                        display: "block",
                      fontSize: "13px",
                      color: "#444",
                      marginTop: "2px",
                      }}
                    >
                      Automatically start PinedIn when you log in
                    </span>
                  </div>
                  {/* Custom toggle switch */}
                  <button
                    onClick={handleAutostartToggle}
                    disabled={autostartLoading}
                    className={`toggle-track${autostartOn ? " active" : ""}`}
                    style={{ flexShrink: 0 }}
                  >
                    <span
                      className={`toggle-thumb${autostartOn ? " active" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {/* Theme */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#888",
                    marginBottom: "8px",
                  }}
                >
                  Theme
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  {themeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleThemeChange(option.value)}
                      className={`pill-toggle${settings.theme === option.value ? " selected" : ""}`}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "6px",
                        padding: "12px 14px",
                      }}
                    >
                      {/* Theme icon */}
                      {option.value === "light" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="5" />
                          <line x1="12" y1="1" x2="12" y2="3" />
                          <line x1="12" y1="21" x2="12" y2="23" />
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                          <line x1="1" y1="12" x2="3" y2="12" />
                          <line x1="21" y1="12" x2="23" y2="12" />
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                        </svg>
                      )}
                      {option.value === "dark" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      )}
                      {option.value === "system" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      )}
                      <span style={{ fontSize: "12px" }}>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Updates */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#888",
                    marginBottom: "8px",
                  }}
                >
                  Updates
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#0a0a0a",
                    border: "1px solid #1a1a1a",
                    borderRadius: "8px",
                    padding: "14px 16px",
                  }}
                >
                  <div>
                    <span
                      style={{
                        display: "block",
                        fontSize: "14px",
                        fontWeight: 500,
                        color: "#ededed",
                      }}
                    >
                      {updateStatus.state === "checking"
                        ? "Checking…"
                        : updateStatus.state === "available"
                          ? `Update v${updateStatus.version} ready`
                          : updateStatus.state === "none"
                            ? "Up to date"
                            : updateStatus.state === "error"
                              ? "Update check failed"
                              : "Auto-update installer"}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: "13px",
                        color: "#444",
                        marginTop: "2px",
                      }}
                    >
                      {updateStatus.state === "error"
                        ? updateStatus.error
                        : updateStatus.state === "idle"
                          ? "Checks for new versions on each build"
                          : ""}
                    </span>
                  </div>
                  <button
                    onClick={handleCheckUpdates}
                    disabled={updateStatus.state === "checking"}
                    className="v-action"
                    style={{ flexShrink: 0, fontSize: "12px", padding: "6px 12px" }}
                  >
                    {updateStatus.state === "checking"
                      ? "⏳"
                      : updateStatus.state === "available"
                        ? "Install"
                        : "Check"}
                  </button>
                </div>
              </div>

              {/* Card Shake Interval */}
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <label
                    style={{
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "#888",
                    }}
                  >
                    Card Shake Interval
                  </label>
                  <AnimatePresence mode="wait">
                    {savedFeedback && (
                      <motion.span
                        key="saved"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          fontSize: "12px",
                          color: "#888",
                        }}
                      >
                        Saved
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div
                  style={{
                    background: "#0a0a0a",
                    border: "1px solid #1a1a1a",
                    borderRadius: "8px",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {/* Preset pills */}
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {SHAKE_PRESETS.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleShakeIntervalChange(s)}
                        style={{
                          flex: "0 0 auto",
                          fontSize: "13px",
                          fontWeight: 500,
                          padding: "6px 14px",
                          borderRadius: "999px",
                          border: "1px solid #1a1a1a",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                          background:
                            shakeInterval === s ? "#fff" : "transparent",
                          color: shakeInterval === s ? "#000" : "#888",
                        }}
                        onMouseEnter={(e) => {
                          if (shakeInterval !== s) {
                            e.currentTarget.style.background = "#111";
                            e.currentTarget.style.color = "#ededed";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (shakeInterval !== s) {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.color = "#888";
                          }
                        }}
                      >
                        {formatPresetLabel(s)}
                      </button>
                    ))}
                  </div>

                  {/* Custom input */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "#555" }}>Custom</span>
                    <input
                      type="number"
                      min={1}
                      max={86400}
                      placeholder="30"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      onKeyDown={handleCustomSubmit}
                      style={{
                        width: "64px",
                        fontSize: "13px",
                        padding: "5px 8px",
                        borderRadius: "6px",
                        border: "1px solid #1a1a1a",
                        background: "#0d0d0d",
                        color: "#ededed",
                        outline: "none",
                      }}
                    />
                    <span style={{ fontSize: "12px", color: "#555" }}>seconds</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
