package com.pinned.mobile.data

import com.pinned.mobile.util.nowIsoUtc
import kotlinx.coroutines.flow.Flow
import java.util.UUID

/**
 * The one way in and out of the capture store. Everything the UI and the sync
 * client need goes through here so id generation and timestamp format live in a
 * single place.
 */
class CaptureRepository(private val dao: CapturedTaskDao) {

    val tasks: Flow<List<CapturedTask>> = dao.observeAll()

    val unsyncedCount: Flow<Int> = dao.observeUnsyncedCount()

    /** Returns false for blank input so the caller can leave the composer open. */
    suspend fun capture(text: String, workspace: String, tags: String = "", dueAt: String? = null): Boolean {
        val trimmed = text.trim()
        if (trimmed.isEmpty()) return false
        dao.insert(
            CapturedTask(
                id = UUID.randomUUID().toString(),
                text = trimmed,
                createdAt = nowIsoUtc(),
                workspace = workspace,
                tags = tags,
                dueAt = dueAt,
            ),
        )
        return true
    }

    suspend fun delete(id: String) = dao.delete(id)

    /** Exactly what a sync would send: everything the laptop hasn't acknowledged. */
    suspend fun pending(): List<CapturedTask> = dao.unsynced()

    /** Tasks that are due now and haven't been notified yet. */
    suspend fun dueTasks(): List<CapturedTask> = dao.dueTasks(nowIsoUtc())

    /** Mark a task as notified so we don't buzz again. */
    suspend fun markNotified(id: String) = dao.markNotified(id)

    /**
     * Marks only the ids that were actually posted. Anything captured while the
     * request was in flight stays pending for the next sync.
     */
    suspend fun markSynced(ids: List<String>) = dao.markSynced(ids, nowIsoUtc())

    suspend fun clearSynced() = dao.clearSynced()

    suspend fun deleteBatch(ids: List<String>) = dao.deleteBatch(ids)

    suspend fun retagBatch(ids: List<String>, tags: String) = dao.retagBatch(ids, tags)
}
