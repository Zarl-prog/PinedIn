package com.pinned.mobile

import android.app.Application
import com.pinned.mobile.DueTaskWorker

class PinnedApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        DueTaskWorker.schedule(this)
    }
}
