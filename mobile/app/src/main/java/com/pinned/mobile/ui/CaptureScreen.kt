package com.pinned.mobile.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.QrCodeScanner
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.Text
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pinned.mobile.data.CapturedTask
import com.pinned.mobile.ui.components.EmptyState
import com.pinned.mobile.ui.theme.PinnedTheme
import com.pinned.mobile.util.relativeTime

/**
 * Home screen: jot tasks on the phone. Syncing to the laptop is secondary —
 * a quiet link when anything is still unsynced.
 */
@Composable
fun CaptureScreen(
    state: CaptureUiState,
    onOpenComposer: () -> Unit,
    onOpenScan: () -> Unit,
    onOpenSettings: () -> Unit,
    onDelete: (String) -> Unit,
) {
    val c = PinnedTheme.colors

    Column(modifier = Modifier.fillMaxSize().background(c.bgApp)) {
        AppBar(
            unsyncedCount = state.unsyncedCount,
            lastSyncAt = state.lastSyncAt,
            onOpenSettings = onOpenSettings,
        )

        Box(modifier = Modifier.weight(1f)) {
            if (state.tasks.isEmpty()) {
                EmptyState(
                    headline = "Nothing captured yet",
                    detail = "Jot something down — it stays on this phone.",
                    actionLabel = "Jot something down",
                    onAction = onOpenComposer,
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(
                        start = 14.dp,
                        end = 14.dp,
                        top = 4.dp,
                        bottom = 8.dp,
                    ),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    item(key = "hdr-recent") {
                        Text(
                            text = "Recent",
                            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
                            color = c.textMuted,
                            modifier = Modifier.padding(horizontal = 4.dp, vertical = 8.dp),
                        )
                    }
                    items(state.pending, key = { it.id }) { task ->
                        SwipeDeleteCard(
                            task = task,
                            onDelete = { onDelete(task.id) },
                        )
                    }
                    items(state.synced, key = { it.id }) { task ->
                        SwipeDeleteCard(
                            task = task,
                            onDelete = { onDelete(task.id) },
                        )
                    }
                }
            }
        }

        if (state.unsyncedCount > 0) {
            QuietSyncLink(
                count = state.unsyncedCount,
                onClick = onOpenScan,
            )
        }

        Composer(
            onOpenComposer = onOpenComposer,
            onOpenScan = onOpenScan,
        )
    }
}

@Composable
private fun AppBar(
    unsyncedCount: Int,
    lastSyncAt: String?,
    onOpenSettings: () -> Unit,
) {
    val c = PinnedTheme.colors
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(start = 18.dp, end = 10.dp, top = 14.dp, bottom = 2.dp),
        ) {
            Text(
                text = "Pinned",
                style = MaterialTheme.typography.titleMedium.copy(
                    fontSize = 20.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = (-0.4).sp,
                ),
                color = c.textPrimary,
            )
            if (unsyncedCount > 0) {
                Spacer(Modifier.width(8.dp))
                Badge(count = unsyncedCount)
            }
            Spacer(Modifier.weight(1f))
            Icon(
                imageVector = Icons.Outlined.Settings,
                contentDescription = "Settings",
                tint = c.textMuted,
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(onClick = onOpenSettings)
                    .padding(8.dp),
            )
        }
        if (lastSyncAt != null) {
            Text(
                text = "Synced ${relativeTime(lastSyncAt)}",
                style = MaterialTheme.typography.bodySmall,
                color = c.textMuted,
                modifier = Modifier.padding(start = 18.dp, bottom = 6.dp),
            )
        } else {
            Text(
                text = "Never synced",
                style = MaterialTheme.typography.bodySmall,
                color = c.textMuted,
                modifier = Modifier.padding(start = 18.dp, bottom = 6.dp),
            )
        }
    }
}

@Composable
private fun Badge(count: Int) {
    val c = PinnedTheme.colors
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .size(22.dp)
            .clip(CircleShape)
            .background(c.accent),
    ) {
        Text(
            text = if (count > 99) "99+" else count.toString(),
            style = MaterialTheme.typography.labelSmall.copy(
                fontWeight = FontWeight.SemiBold,
                fontSize = 10.sp,
            ),
            color = Color.White,
        )
    }
}

/** Secondary path — quiet text, not a promo banner. */
@Composable
private fun QuietSyncLink(count: Int, onClick: () -> Unit) {
    val c = PinnedTheme.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp, vertical = 8.dp),
    ) {
        Text(
            text = if (count == 1) "1 not on laptop yet" else "$count not on laptop yet",
            style = MaterialTheme.typography.bodySmall,
            color = c.textMuted,
            modifier = Modifier.weight(1f),
        )
        Icon(
            imageVector = Icons.AutoMirrored.Filled.KeyboardArrowRight,
            contentDescription = null,
            tint = c.textMuted.copy(alpha = 0.6f),
            modifier = Modifier.size(14.dp),
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SwipeDeleteCard(task: CapturedTask, onDelete: () -> Unit) {
    val c = PinnedTheme.colors
    val rowShape = RoundedCornerShape(12.dp)
    val dismissState = rememberSwipeToDismissBoxState(
        confirmValueChange = { value ->
            if (value == SwipeToDismissBoxValue.EndToStart) {
                onDelete()
            }
            false
        },
    )

    SwipeToDismissBox(
        state = dismissState,
        enableDismissFromStartToEnd = false,
        backgroundContent = {
            val color by animateColorAsState(
                targetValue = if (dismissState.targetValue == SwipeToDismissBoxValue.EndToStart) {
                    c.textDanger.copy(alpha = 0.22f)
                } else {
                    Color.Transparent
                },
                label = "swipe-bg",
            )
            Box(
                contentAlignment = Alignment.CenterEnd,
                modifier = Modifier
                    .fillMaxSize()
                    .clip(rowShape)
                    .background(color)
                    .padding(end = 20.dp),
            ) {
                Icon(
                    imageVector = Icons.Filled.Delete,
                    contentDescription = "Delete",
                    tint = c.textDanger,
                    modifier = Modifier.size(22.dp),
                )
            }
        },
    ) {
        TaskRow(task = task)
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun TaskRow(task: CapturedTask) {
    val c = PinnedTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(if (task.synced) Color.Transparent else c.bgCard)
            .padding(horizontal = 14.dp, vertical = 13.dp),
    ) {
        Text(
            text = task.text,
            style = MaterialTheme.typography.bodyLarge.copy(
                fontWeight = if (task.synced) FontWeight.Normal else FontWeight.Medium,
                letterSpacing = (-0.2).sp,
            ),
            color = if (task.synced) c.textMuted else c.textPrimary,
        )
        Spacer(Modifier.height(7.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = task.workspace,
                style = MaterialTheme.typography.bodySmall,
                color = c.textSecondary,
            )
            Text(
                text = " · ",
                style = MaterialTheme.typography.bodySmall,
                color = c.textMuted.copy(alpha = 0.5f),
            )
            Text(
                text = relativeTime(task.createdAt),
                style = MaterialTheme.typography.bodySmall,
                color = c.textMuted,
            )
        }
    }
}

/** Primary jot dock — scan stays available but visually quiet. */
@Composable
private fun Composer(onOpenComposer: () -> Unit, onOpenScan: () -> Unit) {
    val c = PinnedTheme.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(start = 14.dp, end = 14.dp, top = 8.dp, bottom = 12.dp)
            .clip(RoundedCornerShape(14.dp))
            .background(c.bgFloat)
            .border(1.dp, c.border, RoundedCornerShape(14.dp))
            .padding(start = 16.dp, end = 10.dp, top = 10.dp, bottom = 10.dp),
    ) {
        Box(
            contentAlignment = Alignment.CenterStart,
            modifier = Modifier
                .weight(1f)
                .height(40.dp)
                .clickable(onClick = onOpenComposer)
                .padding(end = 8.dp),
        ) {
            Text(
                text = "Jot something down…",
                style = MaterialTheme.typography.bodyLarge,
                color = c.textMuted,
            )
        }
        Icon(
            imageVector = Icons.Filled.QrCodeScanner,
            contentDescription = "Scan the QR code on your laptop",
            tint = c.textMuted,
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(10.dp))
                .clickable(onClick = onOpenScan)
                .padding(8.dp),
        )
        Spacer(Modifier.width(4.dp))
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(11.dp))
                .background(c.btnPrimaryBg)
                .clickable(onClick = onOpenComposer),
        ) {
            Icon(
                imageVector = Icons.Filled.Add,
                contentDescription = "Add a task",
                tint = c.btnPrimaryText,
                modifier = Modifier.size(22.dp),
            )
        }
    }
}
