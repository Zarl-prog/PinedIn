package com.pinned.mobile

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.pinned.mobile.data.PinnedDatabase
import com.pinned.mobile.data.Prefs
import com.pinned.mobile.util.relativeTime
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

/**
 * Home screen widget: shows unsynced task count, last sync time, the 3 most
 * recent tasks, and a quick-add button. Tapping "Jot something down" opens
 * the app directly to the composer.
 *
 * The widget refreshes:
 *  - Every 30 minutes (updatePeriodMillis in the metadata)
 *  - After every sync (called from CaptureViewModel)
 *  - On app boot (BOOT_COMPLETED)
 */
class PinnedWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray,
    ) {
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        scope.launch {
            for (id in appWidgetIds) {
                updateWidget(context, appWidgetManager, id)
            }
            scope.cancel()
        }
    }

    companion object {
        /**
         * Force-refresh all widget instances. Call this after a successful sync
         * so the badge and task list update immediately.
         */
        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, PinnedWidgetProvider::class.java))
            val intent = Intent(context, PinnedWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
            }
            context.sendBroadcast(intent)
        }

        private suspend fun updateWidget(
            context: Context,
            manager: AppWidgetManager,
            widgetId: Int,
        ) {
            val views = RemoteViews(context.packageName, R.layout.widget_pinned)
            val dao = PinnedDatabase.get(context).capturedTaskDao()
            val prefs = Prefs(context)

            // Unsynced count
            val count = dao.observeUnsyncedCount().first()
            if (count > 0) {
                views.setViewVisibility(R.id.widget_badge, android.view.View.VISIBLE)
                views.setTextViewText(R.id.widget_badge, if (count > 99) "99+" else count.toString())
            } else {
                views.setViewVisibility(R.id.widget_badge, android.view.View.GONE)
            }

            // Last sync
            val lastSync = prefs.lastSyncAt
            views.setTextViewText(
                R.id.widget_sync,
                if (lastSync != null) "Synced ${relativeTime(lastSync)}" else "Never synced",
            )

            // Recent tasks (up to 3)
            val tasks = dao.observeAll().first().take(3)
            val taskViews = listOf(R.id.widget_task_1, R.id.widget_task_2, R.id.widget_task_3)
            taskViews.forEachIndexed { index, viewId ->
                if (index < tasks.size) {
                    views.setViewVisibility(viewId, android.view.View.VISIBLE)
                    views.setTextViewText(viewId, tasks[index].text)
                } else {
                    views.setViewVisibility(viewId, android.view.View.GONE)
                }
            }

            // Tap on "Jot something down" → open app to composer
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                action = QuickTileService.ACTION_OPEN_COMPOSER
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_add_btn, pendingIntent)

            // Tap anywhere on widget → open app
            val tapIntent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val tapPending = PendingIntent.getActivity(
                context,
                1,
                tapIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
            views.setOnClickPendingIntent(R.id.widget_root, tapPending)

            manager.updateAppWidget(widgetId, views)
        }
    }
}
