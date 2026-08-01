package com.pinned.mobile.util

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit

/**
 * ISO-8601 UTC to the second — e.g. `2026-07-26T14:32:00Z`. This is the exact shape
 * the sync payload's `created_at` field uses, so capture and transmission agree.
 */
fun nowIsoUtc(): String =
    DateTimeFormatter.ISO_INSTANT.format(Instant.now().truncatedTo(ChronoUnit.SECONDS))

private val shortDate = DateTimeFormatter.ofPattern("d MMM")

/**
 * "just now" / "12m ago" / "5h ago" / "3d ago", falling back to a date past a week.
 * Unparseable input is returned as-is rather than crashing a list row, and clock
 * skew (a timestamp in the future) reads as "just now".
 */
fun relativeTime(iso: String, now: Instant = Instant.now()): String {
    val then = runCatching { Instant.parse(iso) }.getOrNull() ?: return iso
    val seconds = Duration.between(then, now).seconds
    return when {
        seconds < 45 -> "just now"
        seconds < 3_600 -> "${seconds / 60}m ago"
        seconds < 86_400 -> "${seconds / 3_600}h ago"
        seconds < 7 * 86_400 -> "${seconds / 86_400}d ago"
        else -> then.atZone(ZoneId.systemDefault()).format(shortDate)
    }
}
