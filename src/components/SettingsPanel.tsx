import {
  Compass,
  DownloadSimple,
  GearSix,
  Hourglass,
  Notebook,
  Palette,
  PencilSimpleLine,
  Tag,
} from "@phosphor-icons/react";
import { getVersion } from "@tauri-apps/api/app";
import { emit } from "@tauri-apps/api/event";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useSettings } from "@/hooks/useSettings";
import {
  disableAutostart,
  enableAutostart,
  getShakeInterval,
  isAutostartEnabled,
  setShakeInterval,
} from "@/lib/tauriCommands";
import { checkForUpdates, checkAndInstall } from "@/lib/updater";
import { useReminderStore } from "@/store/reminderStore";

const SHAKE_OPTIONS: { value: number; label: string }[] = [
  { value: 10, label: "10s" },
  { value: 15, label: "15s" },
  { value: 30, label: "30s" },
  { value: 60, label: "1m" },
  { value: 120, label: "2m" },
  { value: 300, label: "5m" },
];

type SettingsTab = "general" | "appearance" | "tasks" | "about";

interface TabItem {
  id: SettingsTab;
  icon: React.ReactNode;
  label: string;
}

interface SettingsPanelProps {
  updateAvailable?: string | null;
}

const tabs: TabItem[] = [
  { id: "general", icon: <GearSix size={15} weight="duotone" />, label: "General" },
  { id: "appearance", icon: <Palette size={15} weight="duotone" />, label: "Appearance" },
  { id: "tasks", icon: <Notebook size={15} weight="duotone" />, label: "Tasks" },
  { id: "about", icon: <DownloadSimple size={15} weight="duotone" />, label: "About" },
];

export default function SettingsPanel(props: SettingsPanelProps) {
  const { settings, updateSetting } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
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
    getShakeInterval().then(setShakeIntervalState).catch(() => {});
  }, []);

  useEffect(() => {
    isAutostartEnabled().then(setAutostartOn).catch(() => {});
  }, []);

  const handleShakeIntervalChange = async (value: number) => {
    setShakeIntervalState(value);
    try { await setShakeInterval(value); } catch {}
  };

  const handleAutostartToggle = async () => {
    setAutostartLoading(true);
    try {
      if (autostartOn) { await disableAutostart(); setAutostartOn(false); }
      else { await enableAutostart(); setAutostartOn(true); }
    } catch {} finally { setAutostartLoading(false); }
  };

  const handleCheckUpdates = async () => {
    if (updateStatus.state === "available") {
      setUpdateStatus({ state: "checking" });
      try {
        const result = await checkAndInstall();
        if (result.installed) setUpdateStatus({ state: "idle" });
      } catch (err) {
        setUpdateStatus({ state: "error", error: err instanceof Error ? err.message : "Install failed" });
      }
      return;
    }
    setUpdateStatus({ state: "checking" });
    try {
      const result = await checkForUpdates();
      if (result.available) setUpdateStatus({ state: "available", version: result.version ?? undefined });
      else setUpdateStatus({ state: "none" });
    } catch (err) {
      setUpdateStatus({ state: "error", error: err instanceof Error ? err.message : "Update check failed" });
    }
  };

  const handleThemeChange = async (theme: string) => {
    try { await updateSetting("theme", theme); } catch {}
  };

  const themeOptions = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "parchment", label: "Parchment" },
    { value: "system", label: "System" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
      <div
        style={{
          width: "180px",
          flexShrink: 0,
          borderRight: "1px solid var(--divider)",
          display: "flex",
          flexDirection: "column",
          padding: "20px 10px",
          gap: "4px",
        }}
      >
        <div style={{ padding: "0 10px 16px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Settings</span>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>Preferences</div>
        </div>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "9px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "none",
              background: activeTab === t.id ? "var(--accent-soft)" : "transparent",
              color: activeTab === t.id ? "var(--accent)" : "var(--text-secondary)",
              fontSize: "13px",
              fontWeight: activeTab === t.id ? 500 : 400,
              cursor: "pointer",
              textAlign: "left",
              transition: "all 0.12s ease",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== t.id) {
                e.currentTarget.style.background = "var(--bg-hover)";
                e.currentTarget.style.color = "var(--text-primary)";
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== t.id) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "var(--text-secondary)";
              }
            }}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: "24px 28px", overflowY: "auto" }}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "general" && (
            <Card>
              <CardRow
                title="Launch at login"
                description="Automatically start Pinned when you log in"
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
              <CardRow
                title="Restart tour"
                description="Replay the guided walkthrough of Pinned"
                control={
                  <button
                    onClick={() => setTimeout(() => emit("show_onboarding").catch(() => {}), 250)}
                    className="feature-btn"
                    style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px" }}
                  >
                    <Compass size={15} weight="light" /> Start
                  </button>
                }
              />
            </Card>
          )}

          {activeTab === "appearance" && (
            <Card>
              <div style={{ padding: "16px" }}>
                <div style={{ marginBottom: "6px", fontSize: "13.5px", fontWeight: 500, color: "var(--text-primary)" }}>Theme</div>
                <div style={{ marginBottom: "14px", fontSize: "12px", color: "var(--text-muted)" }}>Choose how Pinned looks</div>
                <div style={{ display: "flex", gap: "8px" }}>
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
                        gap: "8px",
                        padding: "16px 10px",
                        borderRadius: "10px",
                      }}
                    >
                      {option.value === "light" && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
                          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                          <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
                          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="5.64" />
                        </svg>
                      )}
                      {option.value === "dark" && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                        </svg>
                      )}
                      {option.value === "system" && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                      )}
                      {option.value === "parchment" && (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                          <line x1="8" y1="7" x2="16" y2="7" /><line x1="8" y1="11" x2="14" y2="11" />
                        </svg>
                      )}
                      <span style={{ fontSize: "12px", fontWeight: 500 }}>{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {activeTab === "tasks" && (
            <Card>
              <CardRow
                title="Card shake interval"
                description="How often urgent cards pulse to get your attention"
                control={
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: "200px" }}>
                    {SHAKE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => handleShakeIntervalChange(option.value)}
                        className={`pill-toggle${shakeInterval === option.value ? " selected" : ""}`}
                        style={{ textAlign: "center", padding: "6px 10px", fontSize: "11px" }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                }
              />
              <CardRow
                title="Customize task cards"
                description="Resize your cards by dragging their edges"
                control={
                  <button
                    onClick={() => useReminderStore.getState().setCustomizeOpen(true)}
                    className="feature-btn"
                    style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px" }}
                  >
                    <PencilSimpleLine size={15} weight="light" /> Customize
                  </button>
                }
              />
            </Card>
          )}

          {activeTab === "about" && (
            <Card>
              {props.updateAvailable && updateStatus.state === "idle" && (
                <div style={{ padding: "12px 16px", background: "var(--accent-soft)", borderBottom: "1px solid var(--divider)", fontSize: "12px", color: "var(--accent)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <DownloadSimple size={14} weight="bold" />
                  Update v{props.updateAvailable} available — click Check below
                </div>
              )}
              <CardRow
                title={
                  updateStatus.state === "checking" ? "Checking\u2026"
                  : updateStatus.state === "available" ? `Update v${updateStatus.version} ready`
                  : updateStatus.state === "none" ? "Up to date"
                  : updateStatus.state === "error" ? "Update check failed"
                  : "Software update"
                }
                description={updateStatus.state === "error" ? updateStatus.error : "Checks for new versions on each build"}
                control={
                  <button
                    onClick={handleCheckUpdates}
                    disabled={updateStatus.state === "checking"}
                    className="feature-btn"
                    style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    {updateStatus.state === "checking" ? <Hourglass size={14} weight="light" />
                    : updateStatus.state === "available" ? "Install"
                    : "Check"}
                  </button>
                }
              />
              <CardRow
                title="Version"
                control={
                  <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--text-secondary)", fontFamily: "'Geist Mono', monospace" }}>
                    <Tag size={13} weight="light" /> v{appVersion}
                  </span>
                }
              />
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
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
  );
}

function CardRow({
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
        padding: "14px 16px",
        borderBottom: last ? "none" : "1px solid var(--divider)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: "13.5px", fontWeight: 500, color: "var(--text-primary)" }}>
          {title}
        </span>
        {description && (
          <span style={{ display: "block", fontSize: "12px", color: "var(--text-muted)", marginTop: "3px", lineHeight: 1.5 }}>
            {description}
          </span>
        )}
      </div>
      <div style={{ flexShrink: 0 }}>{control}</div>
    </div>
  );
}
