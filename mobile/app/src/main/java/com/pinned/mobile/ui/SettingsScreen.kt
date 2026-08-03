package com.pinned.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import com.pinned.mobile.data.WORKSPACES
import com.pinned.mobile.ui.components.ChoiceChip
import com.pinned.mobile.ui.components.SectionLabel
import com.pinned.mobile.ui.components.SettingsGroup
import com.pinned.mobile.ui.components.SettingsRow
import com.pinned.mobile.ui.theme.PinnedShape
import com.pinned.mobile.ui.theme.PinnedTheme
import com.pinned.mobile.util.relativeTime

@Composable
fun SettingsScreen(
    state: CaptureUiState,
    onBack: () -> Unit,
    onDefaultWorkspace: (String) -> Unit,
    onKeepComposerOpen: (Boolean) -> Unit,
    onUseLightTheme: (Boolean) -> Unit,
    onClearSynced: () -> Unit,
) {
    val c = PinnedTheme.colors
    var confirmClear by remember { mutableStateOf(false) }
    val syncedCount = state.synced.size

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(c.bgApp),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 12.dp, end = 20.dp, top = 12.dp, bottom = 8.dp),
        ) {
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                contentDescription = "Back",
                tint = c.textSecondary,
                modifier = Modifier
                    .size(44.dp)
                    .clip(PinnedShape.field)
                    .background(c.bgCard)
                    .clickable(onClick = onBack)
                    .padding(11.dp),
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = "Settings",
                style = MaterialTheme.typography.titleMedium,
                color = c.textPrimary,
            )
        }

        Column(
            verticalArrangement = Arrangement.spacedBy(4.dp),
            modifier = Modifier
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp)
                .padding(bottom = 32.dp),
        ) {
            SectionLabel("Capture")

            SettingsGroup {
                SettingsRow(
                    title = "Default workspace",
                    subtitle = "New captures start here",
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                ) {
                    WORKSPACES.forEach { name ->
                        ChoiceChip(
                            label = name,
                            selected = name == state.defaultWorkspace,
                            onClick = { onDefaultWorkspace(name) },
                        )
                    }
                }
                BoxDivider()
                SettingsRow(
                    title = "Keep composer open",
                    subtitle = "Stay in the sheet after adding, for several thoughts in a row",
                    trailing = {
                        Switch(
                            checked = state.keepComposerOpen,
                            onCheckedChange = onKeepComposerOpen,
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = c.btnPrimaryBg,
                                checkedTrackColor = c.accent,
                                uncheckedThumbColor = c.textMuted,
                                uncheckedTrackColor = c.bgBadge,
                                uncheckedBorderColor = c.borderLight,
                            ),
                        )
                    },
                )
            }

            Spacer(Modifier.height(12.dp))
            SectionLabel("Appearance")

            SettingsGroup {
                SettingsRow(
                    title = "Light theme",
                    subtitle = "Switch to a brighter color palette",
                    trailing = {
                        Switch(
                            checked = state.useLightTheme,
                            onCheckedChange = onUseLightTheme,
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = c.btnPrimaryBg,
                                checkedTrackColor = c.accent,
                                uncheckedThumbColor = c.textMuted,
                                uncheckedTrackColor = c.bgBadge,
                                uncheckedBorderColor = c.borderLight,
                            ),
                        )
                    },
                )
            }

            Spacer(Modifier.height(12.dp))
            SectionLabel("Sync")

            SettingsGroup {
                SettingsRow(
                    title = "Last sync",
                    subtitle = state.lastSyncAt?.let { relativeTime(it) }
                        ?: "Never synced from this phone",
                    showDivider = true,
                )
                SettingsRow(
                    title = "Clear synced history",
                    subtitle = if (syncedCount == 0) {
                        "Nothing to clear"
                    } else {
                        "Removes $syncedCount already-sent capture${if (syncedCount == 1) "" else "s"} from this phone"
                    },
                    titleColor = if (syncedCount == 0) c.textMuted else c.textDanger,
                    onClick = if (syncedCount == 0) null else ({ confirmClear = true }),
                )
            }

            Spacer(Modifier.height(12.dp))
            SectionLabel("About")

            SettingsGroup {
                SettingsRow(title = "Version", subtitle = "0.1.0 · capture-only")
            }

            Spacer(Modifier.height(20.dp))
            Text(
                text = "No cloud. No accounts. Tasks only ever travel between this phone and " +
                    "your laptop, over your own WiFi.",
                style = MaterialTheme.typography.bodySmall,
                color = c.textSecondary,
                modifier = Modifier.padding(horizontal = 8.dp),
            )
        }
    }

    if (confirmClear) {
        AlertDialog(
            onDismissRequest = { confirmClear = false },
            containerColor = c.bgCard,
            titleContentColor = c.textPrimary,
            textContentColor = c.textSecondary,
            title = {
                Text("Clear synced history?", style = MaterialTheme.typography.titleMedium)
            },
            text = {
                Text(
                    "This removes $syncedCount capture${if (syncedCount == 1) "" else "s"} " +
                        "from this phone. They stay on your laptop.",
                    style = MaterialTheme.typography.bodyMedium,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    onClearSynced()
                    confirmClear = false
                }) {
                    Text("Clear", color = c.textDanger, style = MaterialTheme.typography.bodyMedium)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmClear = false }) {
                    Text("Cancel", color = c.textSecondary, style = MaterialTheme.typography.bodyMedium)
                }
            },
        )
    }
}

@Composable
private fun BoxDivider() {
    val c = PinnedTheme.colors
    androidx.compose.foundation.layout.Box(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp)
            .height(1.dp)
            .background(c.border),
    )
}
