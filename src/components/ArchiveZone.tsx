import { motion } from "framer-motion";

export default function ArchiveZone() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      style={{
        width: "200px",
        height: "60px",
        background: "rgba(10,10,10,0.85)",
        border: "1px dashed rgba(255,255,255,0.2)",
        borderRadius: "12px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontFamily: "'Geist Mono', monospace",
        fontSize: "11px",
        color: "rgba(255,255,255,0.4)",
        backdropFilter: "blur(8px)"
      }}
    >
      <span style={{ fontSize: "16px" }}>✓</span>
      Drop to complete
    </motion.div>
  );
}
