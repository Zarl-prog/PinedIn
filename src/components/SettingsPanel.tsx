import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Monitor, Sun, Moon, Power } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
import { isAutostartEnabled, enableAutostart, disableAutostart } from "@/lib/tauriCommands";
import { cn } from "@/lib/utils";

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * SettingsPanel - Simplified settings with just theme selection.
 */
export default function SettingsPanel({ open, onClose }: SettingsPanelProps) {
  const { settings, updateSetting } = useSettings();
  const [autostartOn, setAutostartOn] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);

  // Load current autostart state on mount
  useEffect(() => {
    if (open) {
      isAutostartEnabled()
        .then(setAutostartOn)
        .catch(() => {});
    }
  }, [open]);

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
              {/* Launch at login */}
              <div>
                <label className="mb-3 block text-sm font-medium text-foreground">
                  Launch at login
                </label>
                <div className="flex items-center justify-between rounded-xl border border-border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <Power className={cn("h-4 w-4", autostartOn ? "text-primary" : "text-muted-foreground")} />
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {autostartOn ? "Enabled" : "Disabled"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Automatically start PinedIn when you log in
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleAutostartToggle}
                    disabled={autostartLoading}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30",
                      autostartOn ? "bg-primary" : "bg-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                        autostartOn ? "translate-x-[22px]" : "translate-x-[2px]",
                      )}
                    />
                  </button>
                </div>
              </div>

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
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
