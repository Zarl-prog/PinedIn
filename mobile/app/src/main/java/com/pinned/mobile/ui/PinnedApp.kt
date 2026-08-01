package com.pinned.mobile.ui

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
import androidx.lifecycle.viewmodel.compose.viewModel
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

    var screen by remember { mutableStateOf<Screen>(Screen.Capture) }
    var composerOpen by remember { mutableStateOf(false) }

    PinnedTheme {
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

            // After a scan, keep the user on a dedicated syncing screen until the
            // POST finishes — don't flash Capture with no feedback.
            if (state.syncing) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .statusBarsPadding()
                        .navigationBarsPadding(),
                ) {
                    SyncingScreen()
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
                        onClearSynced = vm::clearSyncedHistory,
                    )
                }
            }

            if (composerOpen && screen == Screen.Capture) {
                QuickAddSheet(
                    defaultWorkspace = state.defaultWorkspace,
                    keepOpenAfterSave = state.keepComposerOpen,
                    onSave = vm::capture,
                    onDismiss = { composerOpen = false },
                )
            }
        }
    }
}
