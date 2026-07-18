import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings } from "@/hooks/useSettings";
import { useReminderStore } from "@/store/reminderStore";
import {
  isAutostartEnabled,
  enableAutostart,
  disableAutostart,
  getShakeInterval,
  setShakeInterval,
  setCompactMode,
} from "@/lib/tauriCommands";
import { checkAndInstall } from "@/lib/updater";
import { X, Circle, Hourglass, PencilSimpleLine, Tag, DotsThree } from "@phosphor-icons/react";
import { getVersion } from "@tauri-apps/api/app";

const SHAKE_OPTIONS: { value: number; label: string }[] = [
  { value: 10, label: "10s" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1m" },
  { value: 120, label: "2m" },
  { value: 300, label: "5m" },
];

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  updateAvailable?: string | null;
}

/**
 * SettingsPanel - Monochrome settings panel with theme pills, autostart toggle,
 * shake interval selector, and update controls.
 * All styling uses the exact palette: #0a0a0a, #1a1a1a, #ededed, #fff, etc.
 */
export default function SettingsPanel({ open, onClose, updateAvailable }: SettingsPanelProps) {
  const { settings, updateSetting } = useSettings();
  const [autostartOn, setAutostartOn] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<{
    state: "idle" | "checking" | "available" | "none" | "error";
    version?: string;
    error?: string;
  }>({ state: "idle" });
  const [shakeInterval, setShakeIntervalState] = useState(30);
  const [appVersion, setAppVersion] = useState("...");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("?"));
  }, []);

  useEffect(() => {
    if (open) {
      getShakeInterval().then(setShakeIntervalState).catch(() => {});
    }
  }, [open]);

  const handleShakeIntervalChange = async (value: number) => {
    setShakeIntervalState(value);
    try {
      await setShakeInterval(value);
    } catch (err) {
      console.error("Failed to set shake interval:", err);
    }
  };

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
    try {
      await updateSetting("theme", theme);
    } catch (err) {
      console.error("Failed to update theme:", err);
    }
  };

  const themeOptions = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "parchment", label: "Parchment" },
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
            padding: "24px",
          }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: "absolute",
              inset: 0,
              background: "var(--bg-overlay)",
            }}
            onClick={onClose}
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
              maxWidth: "420px",
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
              <span style={{ fontSize: "17px", fontWeight: 600, color: "var(--text-primary)" }}>
                Settings
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
                  fontSize: "15px",
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

            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Launch at login */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
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
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
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
                        color: "var(--text-primary)",
                      }}
                    >
                      {autostartOn ? "Enabled" : "Disabled"}
                    </span>
                    <span
                      style={{
                        display: "block",
                      fontSize: "13px",
                      color: "var(--text-muted)",
                      marginTop: "2px",
                      }}
                    >
                      Automatically start PinedIn when you log in
                    </span>
                  </div>
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
                    color: "var(--text-secondary)",
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
                          <line x1="18.36" y1="5.64" x2="19.78" y2="5.64" />
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
                      {option.value === "parchment" && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                          <line x1="8" y1="7" x2="16" y2="7" />
                          <line x1="8" y1="11" x2="14" y2="11" />
                        </svg>
                      )}
                      <span style={{ fontSize: "12px" }}>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card shake interval */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    marginBottom: "8px",
                  }}
                >
                  Card shake interval
                </label>
                <div
                  style={{
                    display: "flex",
                    gap: "6px",
                    flexWrap: "wrap",
                  }}
                >
                  {SHAKE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => handleShakeIntervalChange(option.value)}
                      className={`pill-toggle${shakeInterval === option.value ? " selected" : ""}`}
                      style={{
                        flex: 1,
                        minWidth: "56px",
                        textAlign: "center",
                        padding: "10px 12px",
                        fontSize: "12px",
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Customize tasks */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    marginBottom: "8px",
                  }}
                >
                  Customize your tasks
                </label>
                <button
                  onClick={() => { useReminderStore.getState().setCustomizeOpen(true); onClose(); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    padding: "14px 16px",
                    cursor: "pointer",
                    color: "var(--text-primary)",
                    fontSize: "14px",
                    fontWeight: 500,
                    textAlign: "left",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--border-hover, var(--text-muted))"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
                >
                  <PencilSimpleLine size={20} weight="light" style={{ flexShrink: 0, opacity: 0.7 }} />
                  <span>Resize your task cards by dragging their edges</span>
                  <span style={{ marginLeft: "auto", fontSize: "12px", opacity: 0.5 }}>→</span>
                </button>
              </div>

              {/* Updates */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--text-secondary)",
                    marginBottom: "8px",
                  }}
                >
                  Updates {updateAvailable && <span style={{ color: "#ef4444", marginLeft: "6px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}><Circle size={10} weight="fill" />Update v{updateAvailable} ready</span>}
                </label>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border)",
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
                        color: "var(--text-primary)",
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
                        color: "var(--text-muted)",
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
                      ? <Hourglass size={14} weight="light" />
                      : updateStatus.state === "available"
                        ? "Install"
                        : "Check"}
                  </button>
                </div>
              </div>

              {/* Version */}
              <div style={{ marginTop: "4px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "12px" }}>
                <Tag size={13} weight="light" color="var(--text-secondary)" />
                <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontFamily: "'Geist Mono', monospace" }}>
                  v{appVersion}
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
