package com.pinned.mobile.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [CapturedTask::class], version = 1, exportSchema = false)
abstract class PinnedDatabase : RoomDatabase() {

    abstract fun capturedTaskDao(): CapturedTaskDao

    companion object {
        @Volatile
        private var instance: PinnedDatabase? = null

        fun get(context: Context): PinnedDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    PinnedDatabase::class.java,
                    "pinned-mobile.db",
                ).build().also { instance = it }
            }
    }
}
