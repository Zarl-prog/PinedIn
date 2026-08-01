package com.pinned.mobile.sync

import org.json.JSONObject
import java.time.Duration
import java.time.Instant

/**
 * Reads the JSON the desktop encodes into its QR code. Anything malformed — a
 * non-JSON barcode, a missing field, a nonsense port — yields null so the scanner
 * can keep looking instead of navigating away on garbage.
 */
object PairingCodec {
    fun parse(raw: String): PairingInfo? = runCatching {
        val o = JSONObject(raw)
        val info = PairingInfo(
            host = o.getString("host").trim(),
            port = o.getInt("port"),
            token = o.getString("token").trim(),
            expiresAt = o.getString("expires_at").trim(),
        )
        if (info.host.isEmpty() || info.token.isEmpty()) return null
        if (info.port !in 1..65_535) return null
        info
    }.getOrNull()
}

/**
 * Seconds of life left in the pairing token, floored at zero. The desktop is what
 * actually enforces expiry; this is for showing the countdown and for failing fast
 * on a QR code that was screenshotted minutes ago.
 */
fun PairingInfo.secondsLeft(now: Instant = Instant.now()): Long =
    runCatching { Duration.between(now, Instant.parse(expiresAt)).seconds.coerceAtLeast(0L) }
        .getOrDefault(0L)

fun PairingInfo.isExpired(now: Instant = Instant.now()): Boolean = secondsLeft(now) <= 0L
