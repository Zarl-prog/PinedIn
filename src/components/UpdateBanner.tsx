import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";

export default function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const p = listen<string>("update_available", e => {
      setVersion(e.payload);
    });
    return () => { p.then(f => f(), () => {}); };
  }, []);

  async function handleUpdate() {
    setUpdating(true);
    await invoke("install_update");
  }

  return (
    <AnimatePresence>
      {version && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          style={{
            width: "100%",
            background: "var(--bg-update)",
            border: "1px solid var(--border-light)",
            borderRadius: "8px",
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "12px"
          }}
        >
          <div>
            <span style={{ fontSize: "12px", color: "var(--text-primary)", fontWeight: 600 }}>
              Update available — v{version}
            </span>
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", marginLeft: "10px" }}>
              A new version of PinedIn is ready
            </span>
          </div>
          <button
            onClick={handleUpdate}
            disabled={updating}
            className="feature-btn primary"
            style={{
              padding: "6px 14px",
              opacity: updating ? 0.6 : 1,
              cursor: updating ? "not-allowed" : "",
            }}
          >
            {updating ? "Updating..." : "Update Now"}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
