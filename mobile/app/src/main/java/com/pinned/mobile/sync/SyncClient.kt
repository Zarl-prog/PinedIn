package com.pinned.mobile.sync

import com.pinned.mobile.data.CapturedTask

/**
 * Sends a batch of captured tasks to a paired laptop. Phase 4 provides the OkHttp
 * implementation; keeping it behind an interface lets the UI be exercised with a
 * fake that returns a canned [SyncResult].
 */
interface SyncClient {
    suspend fun push(pairing: PairingInfo, tasks: List<CapturedTask>): SyncResult
}
