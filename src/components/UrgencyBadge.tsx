import { cn } from "@/lib/utils";

interface UrgencyBadgeProps {
  urgency: "low" | "medium" | "critical";
  className?: string;
}

const urgencyConfig = {
  low: {
    label: "Low",
    className: "bg-urgency-low/15 text-urgency-low border-urgency-low/30",
  },
  medium: {
    label: "Medium",
    className:
      "bg-urgency-medium/15 text-urgency-medium border-urgency-medium/30",
  },
  critical: {
    label: "Critical",
    className:
      "bg-urgency-critical/15 text-urgency-critical border-urgency-critical/30 animate-pulse-border",
  },
};

/**
 * UrgencyBadge displays the urgency level of a task with appropriate color coding.
 * Critical urgency badges have a pulsing red border animation.
 */
export default function UrgencyBadge({
  urgency,
  className,
}: UrgencyBadgeProps) {
  const config = urgencyConfig[urgency] ?? urgencyConfig.low;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200",
        config.className,
        className,
      )}
    >
      <span
        className={cn("mr-1.5 h-1.5 w-1.5 rounded-full", {
          "bg-urgency-low": urgency === "low",
          "bg-urgency-medium": urgency === "medium",
          "bg-urgency-critical": urgency === "critical",
        })}
      />
      {config.label}
    </span>
  );
}
