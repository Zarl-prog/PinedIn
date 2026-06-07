import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with conflict resolution.
 * Used by shadcn/ui components for conditional styling.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a Date as YYYY-MM-DD using the LOCAL calendar date.
 * `toISOString().split("T")[0]` is the UTC date, which is wrong for
 * any non-UTC user past their offset rollover — a "Quick Add" at
 * 11pm local in UTC-5 would be tagged due "tomorrow".
 */
export function localDateStr(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Format a Date as a local-time ISO 8601 string with timezone offset,
 * e.g. "2026-06-08T14:30:00+05:00". The Rust scheduler compares
 * scheduled_at against `Local::now().to_rfc3339()` (also offset-aware);
 * a naive "YYYY-MM-DDTHH:MM:SS" works by accident under ASCII ordering
 * but breaks for negative offsets.
 */
export function localIsoString(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}
