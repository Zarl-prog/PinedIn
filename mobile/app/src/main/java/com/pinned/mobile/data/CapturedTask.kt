package com.pinned.mobile.data

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * A task jotted down on the phone.
 *
 * v1 is capture-only: rows are created here, pushed to the laptop once, and then
 * kept locally as history. Nothing ever flows back from the desktop, so there is
 * no remote id and no conflict resolution to worry about.
 *
 * [id] is a client-generated UUID string rather than an autoincrementing int so
 * the desktop can dedupe by it if the same batch is ever posted twice.
 */
@Entity(tableName = "captured_tasks")
data class CapturedTask(
    @PrimaryKey val id: String,
    val text: String,
    /** ISO-8601 UTC, e.g. 2026-07-26T14:32:00Z — matches the sync payload contract. */
    val createdAt: String,
    /** Workspace label chosen on the phone; the desktop maps it to a workspace row. */
    val workspace: String,
    /** Set once the laptop has acknowledged the POST. Unsynced rows are what get sent. */
    val synced: Boolean = false,
    /** ISO-8601 UTC timestamp of the successful push, or null while unsynced. */
    val syncedAt: String? = null,
)
