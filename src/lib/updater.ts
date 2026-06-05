import { check } from "@tauri-apps/plugin-updater";

export interface CheckResult {
  available: boolean;
  version: string | null;
  error: string | null;
}

/**
 * Check for updates without installing.
 */
export async function checkForUpdates(): Promise<CheckResult> {
  try {
    const update = await check();
    if (update) {
      return { available: true, version: update.version, error: null };
    }
    return { available: false, version: null, error: null };
  } catch (err) {
    return {
      available: false,
      version: null,
      error: err instanceof Error ? err.message : "Update check failed",
    };
  }
}

/**
 * Check for updates and immediately install + relaunch if available.
 */
export async function checkAndInstall(): Promise<{
  available: boolean;
  installed: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const update = await check();
    if (!update) {
      return { available: false, installed: false };
    }

    await update.downloadAndInstall();
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();

    return { available: true, installed: true, version: update.version };
  } catch (err) {
    return {
      available: false,
      installed: false,
      error: err instanceof Error ? err.message : "Update failed",
    };
  }
}
