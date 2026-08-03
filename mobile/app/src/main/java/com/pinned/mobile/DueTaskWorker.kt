package com.pinned.mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.pinned.mobile.data.PinnedDatabase
import com.pinned.mobile.data.CaptureRepository
import java.util.concurrent.TimeUnit

/**
 * Background worker that checks for due tasks every 15 minutes and shows
 * a notification when a task's due date has passed.
 *
 * The worker is scheduled as a periodic request that survives app restarts.
 * It queries the Room database directly (no network needed) and posts a
 * high-priority notification for each due task.
 */
class DueTaskWorker(
    appContext: Context,
    params: WorkerParameters,
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val repo = CaptureRepository(PinnedDatabase.get(applicationContext).capturedTaskDao())
        val dueTasks = repo.dueTasks()

        if (dueTasks.isEmpty()) return Result.success()

        val notificationManager =
            applicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        createChannelIfNeeded(notificationManager)

        for (task in dueTasks) {
            val intent = Intent(applicationContext, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                applicationContext,
                task.id.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(task.workspace.replaceFirstChar { it.uppercase() })
                .setContentText(task.text)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .build()

            notificationManager.notify(task.id.hashCode(), notification)
            repo.markNotified(task.id)
        }

        return Result.success()
    }

    private fun createChannelIfNeeded(manager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Task Due",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply {
                description = "Notifications when a task is due"
            }
            manager.createNotificationChannel(channel)
        }
    }

    companion object {
        private const val CHANNEL_ID = "pinned_due_tasks"
        private const val WORK_NAME = "pinned_due_check"

        /** Schedule the periodic worker. Safe to call multiple times — it replaces. */
        fun schedule(context: Context) {
            val request = PeriodicWorkRequestBuilder<DueTaskWorker>(
                15, TimeUnit.MINUTES,
            ).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request,
            )
        }
    }
}
