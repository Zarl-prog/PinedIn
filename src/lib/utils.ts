import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Task } from "@/lib/tauriCommands";

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
 * e.g. "2026-06-08T14:30:00+05:00". The offset makes the string an
 * unambiguous absolute instant. The Rust scheduler parses scheduled_at
 * to a DateTime and compares it against `Utc::now()` on the absolute
 * instant (not by raw string), so any valid offset is handled correctly.
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

export function formatCardDate(dateStr: string): string {
  if (!dateStr) return "";
  const due = new Date(dateStr + "T00:00:00");
  if (isNaN(due.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = due.getTime() - today.getTime();
  if (diffTime === 0) return "Today";
  if (diffTime === 86400000) return "Tomorrow";
  if (diffTime === -86400000) return "Yesterday";
  const diffDays = Math.round(diffTime / 86400000);
  if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays > 1) return `In ${diffDays}d`;
  return due.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function sortTasks(a: Task, b: Task): number {
  const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
  const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
  return ta - tb;
}
