package com.pinned.mobile.ui

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pinned.mobile.QuickTileService
import com.pinned.mobile.ui.theme.PinnedDarkColors
import com.pinned.mobile.ui.theme.PinnedLightColors
import com.pinned.mobile.ui.theme.PinnedTheme

/**
 * Screens the app can be on. Small enough that a sealed state beats pulling in
 * navigation-compose — there are no deep links, no back stack to restore, and the
 * only non-linear move is scan → result.
 */
private sealed interface Screen {
    data object Capture : Screen
    data object Scan : Screen
    data object Settings : Screen
}

@Composable
fun PinnedApp(vm: CaptureViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    val outcome by vm.outcome.collectAsState()
    val context = LocalContext.current

    var screen by remember { mutableStateOf<Screen>(Screen.Capture) }
    var composerOpen by remember { mutableStateOf(false) }

    // Handle intents: share text or quick settings tile
    var sharedText by remember { mutableStateOf<String?>(null) }
    remember(Unit) {
        val intent = (context as? android.app.Activity)?.intent
        when {
            // Share intent: receive text from any app
            intent?.action == Intent.ACTION_SEND && intent.type == "text/plain" -> {
                val text = intent.getStringExtra(Intent.EXTRA_TEXT)
                if (!text.isNullOrBlank()) {
                    sharedText = text
                    composerOpen = true
                }
                intent.removeExtra(Intent.EXTRA_TEXT)
                intent.action = null
            }
            // Quick settings tile: open composer directly
            intent?.action == QuickTileService.ACTION_OPEN_COMPOSER -> {
                composerOpen = true
                intent.action = null
            }
        }
    }

    PinnedTheme(colors = if (state.useLightTheme) PinnedLightColors else PinnedDarkColors) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(PinnedTheme.colors.bgApp),
        ) {
            // A finished sync takes over the screen regardless of where we were, so
            // the receipt can't be missed.
            val pending = outcome
            if (pending != null) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .navigationBarsPadding(),
                ) {
                    SyncResultScreen(
                        outcome = pending,
                        onDone = {
                            vm.dismissOutcome()
                            screen = Screen.Capture
                        },
                    )
                }
                return@Box
            }

            when (screen) {
                Screen.Capture -> Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .navigationBarsPadding(),
                ) {
                    CaptureScreen(
                        state = state,
                        onOpenComposer = { composerOpen = true },
                        onOpenScan = { screen = Screen.Scan },
                        onOpenSettings = { screen = Screen.Settings },
                        onDelete = vm::delete,
                    )
                }

                // Edge-to-edge on purpose: the camera fills the screen and draws its
                // own inset-aware chrome.
                Screen.Scan -> ScanScreen(
                    onCancel = { screen = Screen.Capture },
                    onScanned = { pairing ->
                        screen = Screen.Capture
                        vm.syncWith(pairing)
                    },
                )

                Screen.Settings -> Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .navigationBarsPadding(),
                ) {
                    SettingsScreen(
                        state = state,
                        onBack = { screen = Screen.Capture },
                        onDefaultWorkspace = vm::setDefaultWorkspace,
                        onKeepComposerOpen = vm::setKeepComposerOpen,
                        onUseLightTheme = vm::setUseLightTheme,
                        onClearSynced = vm::clearSyncedHistory,
                    )
                }
            }

            if (composerOpen && screen == Screen.Capture) {
                QuickAddSheet(
                    defaultWorkspace = state.defaultWorkspace,
                    keepOpenAfterSave = state.keepComposerOpen,
                    availableTags = state.availableTags,
                    initialText = sharedText ?: "",
                    onSave = { text, workspace, tags, dueAt ->
                        vm.capture(text, workspace, tags, dueAt)
                        sharedText = null
                    },
                    onDismiss = {
                        composerOpen = false
                        sharedText = null
                    },
                )
            }
        }
    }
}
