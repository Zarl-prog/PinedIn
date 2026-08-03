package com.pinned.mobile.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [CapturedTask::class], version = 3, exportSchema = false)
abstract class PinnedDatabase : RoomDatabase() {

    abstract fun capturedTaskDao(): CapturedTaskDao

    companion object {
        @Volatile
        private var instance: PinnedDatabase? = null

        private val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE captured_tasks ADD COLUMN tags TEXT NOT NULL DEFAULT ''")
            }
        }

        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE captured_tasks ADD COLUMN dueAt TEXT")
                db.execSQL("ALTER TABLE captured_tasks ADD COLUMN notified INTEGER NOT NULL DEFAULT 0")
            }
        }

        fun get(context: Context): PinnedDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    PinnedDatabase::class.java,
                    "pinned-mobile.db",
                ).addMigrations(MIGRATION_1_2, MIGRATION_2_3).build().also { instance = it }
            }
    }
}
