package com.pinned.mobile.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CapturedTaskDao {

    /** Everything, newest first — this is what the capture list renders. */
    @Query("SELECT * FROM captured_tasks ORDER BY createdAt DESC")
    fun observeAll(): Flow<List<CapturedTask>>

    @Query("SELECT COUNT(*) FROM captured_tasks WHERE synced = 0")
    fun observeUnsyncedCount(): Flow<Int>

    /** One-shot read used to build the sync payload. */
    @Query("SELECT * FROM captured_tasks WHERE synced = 0 ORDER BY createdAt ASC")
    suspend fun unsynced(): List<CapturedTask>

    @Insert
    suspend fun insert(task: CapturedTask)

    @Query("DELETE FROM captured_tasks WHERE id = :id")
    suspend fun delete(id: String)

    /**
     * Marks a batch synced after the laptop returns 200. Called with the exact ids
     * that were posted, so tasks captured mid-request aren't wrongly marked.
     */
    @Query("UPDATE captured_tasks SET synced = 1, syncedAt = :syncedAt WHERE id IN (:ids)")
    suspend fun markSynced(ids: List<String>, syncedAt: String)

    @Query("DELETE FROM captured_tasks WHERE synced = 1")
    suspend fun clearSynced()
}
