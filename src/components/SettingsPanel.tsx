import { motion, AnimatePresence } from "framer-motion";
import { X, Monitor, Sun, Moon } from "lucide-react";
import { useSettings } from "@/hooks/useSettings";
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
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
