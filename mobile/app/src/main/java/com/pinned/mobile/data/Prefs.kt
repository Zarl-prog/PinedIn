package com.pinned.mobile.data

import android.content.Context

/** The workspace labels the desktop app ships with, plus a catch-all. */
val WORKSPACES = listOf("work", "personal", "inbox")

/**
 * Capture preferences, theme, and last-sync stamp. SharedPreferences is enough —
 * this is a handful of values read once per screen, not a data layer.
 */
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("pinned-prefs", Context.MODE_PRIVATE)

    var defaultWorkspace: String
        get() = sp.getString(KEY_WORKSPACE, WORKSPACES.first()) ?: WORKSPACES.first()
        set(value) = sp.edit().putString(KEY_WORKSPACE, value).apply()

    /** Keeps the quick-add sheet open after saving, for jotting several things at once. */
    var keepComposerOpen: Boolean
        get() = sp.getBoolean(KEY_KEEP_OPEN, true)
        set(value) = sp.edit().putBoolean(KEY_KEEP_OPEN, value).apply()

    /** ISO-8601 UTC, or null if this phone has never completed a sync. */
    var lastSyncAt: String?
        get() = sp.getString(KEY_LAST_SYNC, null)
        set(value) = sp.edit().putString(KEY_LAST_SYNC, value).apply()

    /** false = dark (default), true = light. */
    var useLightTheme: Boolean
        get() = sp.getBoolean(KEY_LIGHT_THEME, false)
        set(value) = sp.edit().putBoolean(KEY_LIGHT_THEME, value).apply()

    private companion object {
        const val KEY_WORKSPACE = "default_workspace"
        const val KEY_KEEP_OPEN = "keep_composer_open"
        const val KEY_LAST_SYNC = "last_sync_at"
        const val KEY_LIGHT_THEME = "use_light_theme"
    }
}
