import {
  Compass,
  DownloadSimple,
  Hourglass,
  Palette,
  PencilSimpleLine,
  Power,
  SlidersHorizontal,
  Tag,
} from "@phosphor-icons/react";
import { getVersion } from "@tauri-apps/api/app";
import { emit } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import {
  disableAutostart,
  enableAutostart,
  getShakeInterval,
  isAutostartEnabled,
  setShakeInterval,
} from "@/lib/tauriCommands";
import { checkAndInstall } from "@/lib/updater";
import { useReminderStore } from "@/store/reminderStore";

const SHAKE_OPTIONS: { value: number; label: string }[] = [
  { value: 10, label: "10s" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1m" },
  { value: 120, label: "2m" },
  { value: 300, label: "5m" },
];

interface SettingsPanelProps {
  updateAvailable?: string | null;
}

/** A titled group of settings rows, rendered as one card. */
function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          margin: "0 2px 8px",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.5px",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        <span style={{ display: "flex", color: "var(--text-secondary)" }}>{icon}</span>
        {title}
      </div>
      <div
        style={{
          background: "var(--bg-input)",
          border: "1px solid var(--border)",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** A single settings row: leading text block + trailing control. Rows inside
 *  a Section are separated by a hairline divider (all but the last). */
function Row({
  title,
  description,
  control,
  last,
}: {
  title: string;
  description?: string;
  control: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "14px",
        padding: "13px 15px",
        borderBottom: last ? "none" : "1px solid var(--divider)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span
          style={{
            display: "block",
            fontSize: "13.5px",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          {title}
        </span>
        {description && (
          <span
            style={{
              display: "block",
              fontSize: "12px",
              color: "var(--text-muted)",
              marginTop: "3px",
              lineHeight: 1.5,
            }}
          >
            {description}
          </span>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}

/**
 * SettingsPanel - Monochrome settings panel with theme pills, autostart toggle,
 * shake interval selector, and update controls.
 * All styling uses the exact palette: #0a0a0a, #1a1a1a, #ededed, #fff, etc.
 */
export default function SettingsPanel({ updateAvailable }: SettingsPanelProps) {
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
    getVersion()
      .then(setAppVersion)
      .catch(() => setAppVersion("?"));
  }, []);

  useEffect(() => {
    getShakeInterval()
      .then(setShakeIntervalState)
      .catch(() => {});
  }, []);

  const handleShakeIntervalChange = async (value: number) => {
    setShakeIntervalState(value);
    try {
      await setShakeInterval(value);
    } catch (err) {
      console.error("Failed to set shake interval:", err);
    }
  };

  useEffect(() => {
    isAutostartEnabled()
      .then(setAutostartOn)
      .catch(() => {});
  }, []);

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
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "24px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "11px",
          marginBottom: "24px",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "34px",
            height: "34px",
            borderRadius: "10px",
            background: "var(--accent-soft)",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <SlidersHorizontal size={17} weight="bold" />
        </div>
        <div>
          <span
            style={{
              display: "block",
              fontSize: "17px",
              fontWeight: 600,
              color: "var(--text-primary)",
              lineHeight: 1.2,
            }}
          >
            Settings
          </span>
          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Preferences &amp; appearance
          </span>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          overflowY: "auto",
          flex: 1,
          margin: "0 -4px",
          padding: "0 4px",
        }}
      >
              {/* ─── General ─────────────────────────────────────── */}
              <Section icon={<Power size={13} weight="bold" />} title="General">
                <Row
                  title="Launch at login"
                  description="Automatically start PinedIn when you log in"
                  control={
                    <button
                      onClick={handleAutostartToggle}
                      disabled={autostartLoading}
                      className={`toggle-track${autostartOn ? " active" : ""}`}
                    >
                      <span className={`toggle-thumb${autostartOn ? " active" : ""}`} />
                    </button>
                  }
                />
                <Row
                  last
                  title="Restart tour"
                  description="Replay the guided walkthrough of PinedIn"
                  control={
                    <button
                      type="button"
                      onClick={() => {
                        setTimeout(() => {
                          emit("show_onboarding").catch(() => {});
                        }, 250);
                      }}
                      className="feature-btn"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                      }}
                    >
                      <Compass size={15} weight="light" /> Start
                    </button>
                  }
                />
              </Section>

              {/* ─── Appearance ──────────────────────────────────── */}
              <Section icon={<Palette size={13} weight="bold" />} title="Appearance">
                <div style={{ padding: "13px 15px" }}>
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
                          padding: "12px 10px",
                          borderRadius: "9px",
                        }}
                      >
                      {option.value === "light" && (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
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
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      )}
                      {option.value === "system" && (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                          <line x1="8" y1="21" x2="16" y2="21" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      )}
                      {option.value === "parchment" && (
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
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
              </Section>

              {/* ─── Tasks ───────────────────────────────────────── */}
              <Section icon={<SlidersHorizontal size={13} weight="bold" />} title="Tasks">
                <Row
                  title="Card shake interval"
                  description="How often urgent cards pulse to get your attention"
                  control={
                    <div
                      style={{
                        display: "flex",
                        gap: "4px",
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                        maxWidth: "180px",
                      }}
                    >
                      {SHAKE_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => handleShakeIntervalChange(option.value)}
                          className={`pill-toggle${shakeInterval === option.value ? " selected" : ""}`}
                          style={{
                            textAlign: "center",
                            padding: "5px 9px",
                            fontSize: "11px",
                          }}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  }
                />
                <Row
                  last
                  title="Customize task cards"
                  description="Resize your cards by dragging their edges"
                  control={
                    <button
                      onClick={() => {
                        useReminderStore.getState().setCustomizeOpen(true);
                      }}
                      className="feature-btn"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 14px",
                      }}
                    >
                      <PencilSimpleLine size={15} weight="light" /> Customize
                    </button>
                  }
                />
              </Section>

              {/* ─── About ───────────────────────────────────────── */}
              <Section icon={<DownloadSimple size={13} weight="bold" />} title="About">
                <Row
                  last={!updateAvailable}
                  title={
                    updateStatus.state === "checking"
                      ? "Checking…"
                      : updateStatus.state === "available"
                        ? `Update v${updateStatus.version} ready`
                        : updateStatus.state === "none"
                          ? "Up to date"
                          : updateStatus.state === "error"
                            ? "Update check failed"
                            : "Software update"
                  }
                  description={
                    updateStatus.state === "error"
                      ? updateStatus.error
                      : "Checks for new versions on each build"
                  }
                  control={
                    <button
                      onClick={handleCheckUpdates}
                      disabled={updateStatus.state === "checking"}
                      className="feature-btn"
                      style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      {updateStatus.state === "checking" ? (
                        <Hourglass size={14} weight="light" />
                      ) : updateStatus.state === "available" ? (
                        "Install"
                      ) : (
                        "Check"
                      )}
                    </button>
                  }
                />
                <Row
                  last
                  title="Version"
                  control={
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                        color: "var(--text-secondary)",
                        fontFamily: "'Geist Mono', monospace",
                      }}
                    >
                      <Tag size={13} weight="light" /> v{appVersion}
                    </span>
                  }
                />
              </Section>
      </div>
    </div>
  );
}
