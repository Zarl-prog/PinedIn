import { motion, AnimatePresence } from "framer-motion";
import { X, Monitor, Sun, Moon, Volume2, VolumeX, Power } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { useReminderStore } from "@/store/reminderStore";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * SettingsPanel - Full settings interface with:
 * - Default snooze duration
 * - Start on boot toggle
 * - Sound on popup toggle
 * - Theme selector (light / dark / system)
 * - Quiet hours configuration
 */
export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, updateSetting } = useSettings();
  const dismissAllPopups = useReminderStore((s) => s.dismissAllPopups);

  const handleThemeChange = async (theme: string) => {
    await updateSetting("theme", theme);
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-border/50 bg-card p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">Settings</h2>
              <button
                onClick={onClose}
                className="rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Theme */}
              <div>
                <label className="mb-3 block text-sm font-medium text-foreground">
                  Theme
                </label>
                <div className="flex gap-2">
                  {[
                    {
                      value: "light",
                      label: "Light",
                      icon: Sun,
                    },
                    {
                      value: "dark",
                      label: "Dark",
                      icon: Moon,
                    },
                    {
                      value: "system",
                      label: "System",
                      icon: Monitor,
                    },
                  ].map((option) => (
                    <motion.button
                      key={option.value}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleThemeChange(option.value)}
                      className={cn(
                        "flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 transition-all",
                        settings.theme === option.value
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30",
                      )}
                    >
                      <option.icon
                        className={cn(
                          "h-5 w-5",
                          settings.theme === option.value && "text-primary",
                        )}
                      />
                      <span className="text-xs font-medium">
                        {option.label}
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Default Snooze Duration */}
              <div>
                <label className="mb-3 block text-sm font-medium text-foreground">
                  Default Snooze Duration
                </label>
                <div className="flex gap-2">
                  {[5, 10, 30, 60].map((mins) => (
                    <motion.button
                      key={mins}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() =>
                        updateSetting(
                          "default_snooze_minutes",
                          mins.toString(),
                        )
                      }
                      className={cn(
                        "flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all",
                        settings.default_snooze_minutes === mins
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-muted-foreground/30",
                      )}
                    >
                      {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-4">
                {/* Sound */}
                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-4">
                  <div className="flex items-center gap-3">
                    {settings.sound_enabled ? (
                      <Volume2 className="h-5 w-5 text-primary" />
                    ) : (
                      <VolumeX className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Sound on Popup
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Play a sound when reminder appears
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      updateSetting(
                        "sound_enabled",
                        String(!settings.sound_enabled),
                      )
                    }
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      settings.sound_enabled
                        ? "bg-primary"
                        : "bg-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                        settings.sound_enabled && "translate-x-5",
                      )}
                    />
                  </button>
                </div>

                {/* Start on Boot */}
                <div className="flex items-center justify-between rounded-xl border border-border/50 bg-background p-4">
                  <div className="flex items-center gap-3">
                    <Power
                      className={cn(
                        "h-5 w-5",
                        settings.start_on_boot
                          ? "text-primary"
                          : "text-muted-foreground",
                      )}
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Start on Boot
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Launch PinedIn when you log in
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      updateSetting(
                        "start_on_boot",
                        String(!settings.start_on_boot),
                      )
                    }
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      settings.start_on_boot
                        ? "bg-primary"
                        : "bg-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                        settings.start_on_boot && "translate-x-5",
                      )}
                    />
                  </button>
                </div>
              </div>

              {/* Quiet Hours */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <label className="text-sm font-medium text-foreground">
                    Quiet Hours
                  </label>
                  <button
                    onClick={() => {
                      if (settings.quiet_hours_start) {
                        updateSetting("quiet_hours_start", "");
                        updateSetting("quiet_hours_end", "");
                      } else {
                        updateSetting("quiet_hours_start", "23:00");
                        updateSetting("quiet_hours_end", "07:00");
                      }
                    }}
                    className={cn(
                      "relative h-6 w-11 rounded-full transition-colors",
                      settings.quiet_hours_start
                        ? "bg-primary"
                        : "bg-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                        settings.quiet_hours_start && "translate-x-5",
                      )}
                    />
                  </button>
                </div>
                {settings.quiet_hours_start && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs text-muted-foreground">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={settings.quiet_hours_start}
                        onChange={(e) =>
                          updateSetting(
                            "quiet_hours_start",
                            e.target.value,
                          )
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="mb-1.5 block text-xs text-muted-foreground">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={settings.quiet_hours_end ?? ""}
                        onChange={(e) =>
                          updateSetting(
                            "quiet_hours_end",
                            e.target.value,
                          )
                        }
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  </div>
                )}
                {!settings.quiet_hours_start && (
                  <p className="text-xs text-muted-foreground">
                    Quiet hours are disabled. Enable to suppress reminders during specific times.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
