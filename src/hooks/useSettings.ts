import { useEffect } from "react";
import { useReminderStore } from "@/store/reminderStore";

/**
 * Hook that loads settings on mount and provides save helpers.
 * Settings are persisted to SQLite via Tauri commands.
 */
export function useSettings() {
  const settings = useReminderStore((s) => s.settings);
  // Stable action refs
  const fetchSettings = useReminderStore.getState().fetchSettings;
  const saveSetting = useReminderStore.getState().saveSetting;

  useEffect(() => {
    fetchSettings();
  }, []); // fetchSettings is stable

  const updateSetting = async (key: string, value: string | boolean | number) => {
    const stringValue = String(value);
    await saveSetting(key, stringValue);
  };

  return {
    settings,
    updateSetting,
  };
}
