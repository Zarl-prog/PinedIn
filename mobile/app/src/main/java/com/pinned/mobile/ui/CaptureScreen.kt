package com.pinned.mobile.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
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
import androidx.compose.foundation.layout.navigationBarsPadding
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
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Label
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
    onBatchDelete: (List<String>) -> Unit,
    onBatchRetag: (List<String>, String) -> Unit,
) {
    val c = PinnedTheme.colors
    var selectedIds by remember { mutableStateOf(setOf<String>()) }
    val selectionMode = selectedIds.isNotEmpty()

    fun toggleSelect(id: String) {
        selectedIds = if (id in selectedIds) selectedIds - id else selectedIds + id
    }

    fun clearSelection() { selectedIds = emptySet() }

    Column(modifier = Modifier.fillMaxSize().background(c.bgApp)) {
        AppBar(
            unsyncedCount = state.unsyncedCount,
            lastSyncAt = state.lastSyncAt,
            selectionMode = selectionMode,
            selectedCount = selectedIds.size,
            onSelectAll = { selectedIds = state.tasks.map { it.id }.toSet() },
            onClearSelection = ::clearSelection,
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
                        val isSelected = task.id in selectedIds
                        if (selectionMode) {
                            SelectableTaskRow(
                                task = task,
                                selected = isSelected,
                                onClick = { toggleSelect(task.id) },
                            )
                        } else {
                            SwipeDeleteCard(
                                task = task,
                                onDelete = { onDelete(task.id) },
                            )
                        }
                    }
                    items(state.synced, key = { it.id }) { task ->
                        val isSelected = task.id in selectedIds
                        if (selectionMode) {
                            SelectableTaskRow(
                                task = task,
                                selected = isSelected,
                                onClick = { toggleSelect(task.id) },
                            )
                        } else {
                            SwipeDeleteCard(
                                task = task,
                                onDelete = { onDelete(task.id) },
                            )
                        }
                    }
                }
            }
        }

        // Batch action bar
        AnimatedVisibility(
            visible = selectionMode,
            enter = slideInVertically(initialOffsetY = { it }) + fadeIn(),
            exit = slideOutVertically(targetOffsetY = { it }) + fadeOut(),
        ) {
            BatchActionBar(
                selectedCount = selectedIds.size,
                onDelete = {
                    onBatchDelete(selectedIds.toList())
                    clearSelection()
                },
                onRetag = { tag ->
                    onBatchRetag(selectedIds.toList(), tag)
                    clearSelection()
                },
                onDismiss = ::clearSelection,
            )
        }

        if (!selectionMode && state.unsyncedCount > 0) {
            QuietSyncLink(
                count = state.unsyncedCount,
                onClick = onOpenScan,
            )
        }

        if (!selectionMode) {
            Composer(
                onOpenComposer = onOpenComposer,
                onOpenScan = onOpenScan,
            )
        }
    }
}

@Composable
private fun AppBar(
    unsyncedCount: Int,
    lastSyncAt: String?,
    selectionMode: Boolean,
    selectedCount: Int,
    onSelectAll: () -> Unit,
    onClearSelection: () -> Unit,
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
            if (selectionMode) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = "Clear selection",
                    tint = c.textSecondary,
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .clickable(onClick = onClearSelection)
                        .padding(8.dp),
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "$selectedCount selected",
                    style = MaterialTheme.typography.titleMedium.copy(
                        fontSize = 18.sp,
                        fontWeight = FontWeight.SemiBold,
                    ),
                    color = c.accent,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    text = "Select all",
                    style = MaterialTheme.typography.bodyMedium,
                    color = c.accent,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(onClick = onSelectAll)
                        .padding(horizontal = 12.dp, vertical = 8.dp),
                )
            } else {
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
        }
        if (!selectionMode) {
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
}

@Composable
private fun BatchActionBar(
    selectedCount: Int,
    onDelete: () -> Unit,
    onRetag: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val c = PinnedTheme.colors
    var showRetagMenu by remember { mutableStateOf(false) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .navigationBarsPadding()
            .background(c.bgFloat)
            .border(1.dp, c.border),
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
        ) {
            // Delete button
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .clickable(onClick = onDelete)
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                Icon(
                    imageVector = Icons.Filled.Delete,
                    contentDescription = "Delete",
                    tint = c.textDanger,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = "Delete",
                    style = MaterialTheme.typography.bodyMedium,
                    color = c.textDanger,
                )
            }

            Spacer(Modifier.weight(1f))

            // Retag button
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .clickable { showRetagMenu = true }
                    .padding(horizontal = 12.dp, vertical = 8.dp),
            ) {
                Icon(
                    imageVector = Icons.Filled.Label,
                    contentDescription = "Retag",
                    tint = c.accent,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    text = "Retag",
                    style = MaterialTheme.typography.bodyMedium,
                    color = c.accent,
                )
            }
        }

        // Simple retag dropdown
        if (showRetagMenu) {
            Column(
                modifier = Modifier
                    .align(Alignment.BottomEnd)
                    .padding(end = 16.dp, bottom = 56.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(c.bgCard)
                    .border(1.dp, c.border, RoundedCornerShape(12.dp))
                    .padding(vertical = 4.dp),
            ) {
                listOf("urgent", "later", "idea", "errand").forEach { tag ->
                    Text(
                        text = tag,
                        style = MaterialTheme.typography.bodyMedium,
                        color = c.textPrimary,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onRetag(tag)
                                showRetagMenu = false
                            }
                            .padding(horizontal = 20.dp, vertical = 10.dp),
                    )
                }
            }
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
private fun SelectableTaskRow(
    task: CapturedTask,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val c = PinnedTheme.colors
    val bg by animateColorAsState(
        targetValue = if (selected) c.accentSoft else if (task.synced) Color.Transparent else c.bgCard,
        label = "select-bg",
    )
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(bg)
            .border(
                width = if (selected) 1.5.dp else 0.dp,
                color = if (selected) c.accent else Color.Transparent,
                shape = RoundedCornerShape(12.dp),
            )
            .combinedClickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 13.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = if (selected) Icons.Filled.CheckCircle else Icons.Filled.CheckCircle,
                contentDescription = if (selected) "Deselect" else "Select",
                tint = if (selected) c.accent else c.border,
                modifier = Modifier.size(20.dp),
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = task.text,
                style = MaterialTheme.typography.bodyLarge.copy(
                    fontWeight = if (task.synced) FontWeight.Normal else FontWeight.Medium,
                    letterSpacing = (-0.2).sp,
                ),
                color = if (task.synced) c.textMuted else c.textPrimary,
                modifier = Modifier.weight(1f),
            )
        }
        Spacer(Modifier.height(7.dp))
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(start = 30.dp),
        ) {
            Text(
                text = task.workspace,
                style = MaterialTheme.typography.bodySmall,
                color = c.textSecondary,
            )
            if (task.tags.isNotBlank()) {
                task.tags.split(",").forEach { tag ->
                    Text(
                        text = " · ",
                        style = MaterialTheme.typography.bodySmall,
                        color = c.textMuted.copy(alpha = 0.5f),
                    )
                    Text(
                        text = tag.trim(),
                        style = MaterialTheme.typography.bodySmall,
                        color = c.accent,
                    )
                }
            }
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
            if (task.tags.isNotBlank()) {
                task.tags.split(",").forEach { tag ->
                    Text(
                        text = " · ",
                        style = MaterialTheme.typography.bodySmall,
                        color = c.textMuted.copy(alpha = 0.5f),
                    )
                    Text(
                        text = tag.trim(),
                        style = MaterialTheme.typography.bodySmall,
                        color = c.accent,
                    )
                }
            }
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
