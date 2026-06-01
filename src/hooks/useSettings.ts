import { useEffect } from "react";
import { useReminderStore } from "@/store/reminderStore";

/**
 * Hook that loads settings on mount and provides save helpers.
 * Settings are persisted to SQLite via Tauri commands.
 */
export function useSettings() {
  const fetchSettings = useReminderStore((s) => s.fetchSettings);
  const saveSetting = useReminderStore((s) => s.saveSetting);
  const settings = useReminderStore((s) => s.settings);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  /**
   * Update a single setting in both local state and SQLite.
   */
  const updateSetting = async (
    key: string,
    value: string | boolean | number,
  ) => {
    const stringValue = String(value);
    await saveSetting(key, stringValue);
  };

  return {
    settings,
    updateSetting,
  };
}
