import React from "react";

interface ShinyTextProps {
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  speed?: number;
  style?: React.CSSProperties;
}

export function ShinyText({ children, className = "", disabled = false, speed = 5, style }: ShinyTextProps) {
  if (disabled) return <span className={className} style={style}>{children}</span>;
  return (
    <span
      className={`shiny-text ${className}`}
      style={{ animationDuration: `${speed}s`, ...style }}
    >
      {children}
    </span>
  );
}
