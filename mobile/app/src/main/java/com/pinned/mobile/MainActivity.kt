package com.pinned.mobile

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.pinned.mobile.ui.PinnedApp

/**
 * Single-activity host. [PinnedApp] owns the whole surface — capture list,
 * quick add, QR scan, sync receipt — so there is nothing to configure here
 * beyond going edge-to-edge; the screens apply their own window insets.
 */
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { PinnedApp() }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
    }
}
