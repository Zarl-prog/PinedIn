package com.pinned.mobile.sync

/**
 * What a scanned QR code carries. The desktop encodes this as JSON:
 *
 *     {"host":"192.168.1.24","port":7391,"token":"a1b2c3...","expires_at":"2026-07-26T14:33:00Z"}
 *
 * The token is short-lived (60–120s) so a screenshotted QR can't be replayed later.
 */
data class PairingInfo(
    val host: String,
    val port: Int,
    val token: String,
    val expiresAt: String,
) {
    val url: String get() = "http://$host:$port/sync"
}

/** Outcome of one sync attempt, rendered on the sync-result screen. */
sealed interface SyncResult {
    data class Success(val count: Int) : SyncResult
    /** Nothing unsynced — the scan was a no-op. */
    data object NothingToSync : SyncResult
    data class Failure(val reason: String) : SyncResult
}
