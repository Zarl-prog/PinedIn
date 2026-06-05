interface UrgencyBadgeProps {
  urgency: "low" | "medium" | "critical";
  className?: string;
}

const urgencyLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  critical: "Critical",
};

const urgencyClasses: Record<string, string> = {
  low: "badge low",
  medium: "badge medium",
  critical: "badge critical",
};

/**
 * UrgencyBadge - Monochrome-only badge system.
 * Uses CSS classes from index.css: .badge, .badge.critical, .badge.medium, .badge.low
 * No colors outside the monochrome palette are used.
 */
export default function UrgencyBadge({
  urgency,
  className = "",
}: UrgencyBadgeProps) {
  const baseClass = urgencyClasses[urgency] ?? "badge";
  const label = urgencyLabels[urgency] ?? urgency;

  return (
    <span className={`${baseClass} ${className}`}>
      {label}
    </span>
  );
}
