import { motion } from "framer-motion";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
  className?: string;
}

export default function Skeleton({
  width = "100%",
  height = 16,
  borderRadius = 6,
  style,
  className,
}: SkeletonProps) {
  return (
    <motion.div
      aria-hidden="true"
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, var(--skeleton-from, #1a1a1a) 25%, var(--skeleton-to, #2a2a2a) 50%, var(--skeleton-from, #1a1a1a) 75%)",
        backgroundSize: "200% 100%",
        flexShrink: 0,
        ...style,
      }}
      initial={{ backgroundPosition: "200% 0" }}
      animate={{ backgroundPosition: "-200% 0" }}
      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
    />
  );
}
