package com.pinned.mobile

import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import com.pinned.mobile.MainActivity

/**
 * Quick settings tile: pull down notification shade, tap Pinned to open the
 * composer directly. This is the fastest way to jot a thought without finding
 * the app icon.
 */
class QuickTileService : TileService() {

    override fun onStartListening() {
        super.onStartListening()
        qsTile?.let { tile ->
            tile.state = Tile.STATE_ACTIVE
            tile.label = "Pinned"
            tile.updateTile()
        }
    }

    override fun onClick() {
        super.onClick()
        val intent = Intent(this, MainActivity::class.java).apply {
            action = ACTION_OPEN_COMPOSER
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }
        startActivityAndCollapse(intent)
    }

    companion object {
        const val ACTION_OPEN_COMPOSER = "com.pinned.mobile.ACTION_OPEN_COMPOSER"
    }
}
