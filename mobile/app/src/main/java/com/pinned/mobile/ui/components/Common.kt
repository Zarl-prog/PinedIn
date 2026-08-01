package com.pinned.mobile.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.EditNote
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.pinned.mobile.ui.theme.PinnedShape
import com.pinned.mobile.ui.theme.PinnedTheme

/** Uppercase, tracked-out section header — "CAPTURED", "SYNCED". */
@Composable
fun SectionLabel(text: String, count: Int? = null, modifier: Modifier = Modifier) {
    val c = PinnedTheme.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier.padding(horizontal = 4.dp, vertical = 10.dp),
    ) {
        Text(
            text = text.uppercase(),
            style = MaterialTheme.typography.labelSmall,
            color = c.textSecondary,
        )
        if (count != null) {
            Spacer(Modifier.width(8.dp))
            Text(
                text = "· $count",
                style = MaterialTheme.typography.labelSmall,
                color = c.textMuted,
            )
        }
    }
}

/** Soft tint per workspace so tags scan at a glance. */
@Composable
fun workspaceAccent(workspace: String): Color {
    val c = PinnedTheme.colors
    return when (workspace.lowercase()) {
        "work" -> c.accent
        "personal" -> Color(0xFFC084FC)
        "inbox" -> Color(0xFF34D399)
        else -> c.textSecondary
    }
}

/** Small outlined chip used for workspace tags on a card. */
@Composable
fun WorkspaceTag(workspace: String) {
    val c = PinnedTheme.colors
    val tint = workspaceAccent(workspace)
    Text(
        text = workspace,
        style = MaterialTheme.typography.bodySmall,
        color = tint,
        modifier = Modifier
            .clip(PinnedShape.pill)
            .background(tint.copy(alpha = 0.12f))
            .border(1.dp, tint.copy(alpha = 0.35f), PinnedShape.pill)
            .padding(horizontal = 9.dp, vertical = 3.dp),
    )
}

/** Count badge in the app bar; hidden entirely at zero rather than showing "0". */
@Composable
fun UnsyncedBadge(count: Int) {
    if (count <= 0) return
    val c = PinnedTheme.colors
    Text(
        text = if (count == 1) "1 unsynced" else "$count unsynced",
        style = MaterialTheme.typography.bodySmall,
        color = c.accent,
        modifier = Modifier
            .clip(PinnedShape.pill)
            .background(c.accentSoft)
            .border(1.dp, c.accentRing, PinnedShape.pill)
            .padding(horizontal = 10.dp, vertical = 5.dp),
    )
}

/** Selectable workspace chip in the composer and settings. */
@Composable
fun ChoiceChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
) {
    val c = PinnedTheme.colors
    Text(
        text = label,
        style = MaterialTheme.typography.bodySmall,
        color = if (selected) c.btnPrimaryText else c.textSecondary,
        modifier = Modifier
            .clip(PinnedShape.pill)
            .background(if (selected) c.btnPrimaryBg else c.bgBadge)
            .border(1.dp, if (selected) c.btnPrimaryBg else c.border, PinnedShape.pill)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

/** Full-width primary action button. */
@Composable
fun PrimaryButton(
    label: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    onClick: () -> Unit,
) {
    val c = PinnedTheme.colors
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .height(52.dp)
            .clip(PinnedShape.field)
            .background(if (enabled) c.btnPrimaryBg else c.bgHover)
            .clickable(enabled = enabled, onClick = onClick),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium.copy(
                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
            ),
            color = if (enabled) c.btnPrimaryText else c.textMuted,
        )
    }
}

/** Bordered, transparent button — the secondary action next to [PrimaryButton]. */
@Composable
fun GhostButton(
    label: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val c = PinnedTheme.colors
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .height(52.dp)
            .clip(PinnedShape.field)
            .border(1.dp, c.borderLight, PinnedShape.field)
            .clickable(onClick = onClick)
            .padding(horizontal = 18.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = c.textSecondary,
        )
    }
}

/**
 * A single row inside a [SettingsGroup]. Callers wrap several of these in one
 * group so the section reads as one card with hairline dividers.
 */
@Composable
fun SettingsRow(
    title: String,
    subtitle: String? = null,
    titleColor: Color? = null,
    onClick: (() -> Unit)? = null,
    showDivider: Boolean = false,
    trailing: @Composable () -> Unit = {},
) {
    val c = PinnedTheme.colors
    Column {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier)
                .padding(horizontal = 16.dp, vertical = 14.dp),
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium,
                    color = titleColor ?: c.textPrimary,
                )
                if (subtitle != null) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = subtitle,
                        style = MaterialTheme.typography.bodySmall,
                        color = c.textMuted,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(Modifier.width(12.dp))
            trailing()
        }
        if (showDivider) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .height(1.dp)
                    .background(c.border),
            )
        }
    }
}

/** Card wrapping several [SettingsRow]s with a shared border. */
@Composable
fun SettingsGroup(content: @Composable ColumnScope.() -> Unit) {
    val c = PinnedTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(PinnedShape.card)
            .background(c.bgCard)
            .border(1.dp, c.border, PinnedShape.card),
        content = content,
    )
}

/** Centred empty state for the capture list, with an optional primary CTA. */
@Composable
fun EmptyState(
    headline: String,
    detail: String,
    actionLabel: String? = null,
    onAction: (() -> Unit)? = null,
) {
    val c = PinnedTheme.colors
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 32.dp, vertical = 48.dp),
    ) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(64.dp)
                .clip(CircleShape)
                .background(c.bgBadge)
                .border(1.dp, c.border, CircleShape),
        ) {
            Icon(
                imageVector = Icons.Outlined.EditNote,
                contentDescription = null,
                tint = c.accent,
                modifier = Modifier.size(28.dp),
            )
        }
        Spacer(Modifier.height(20.dp))
        Text(
            text = headline,
            style = MaterialTheme.typography.titleMedium,
            color = c.textPrimary,
        )
        Spacer(Modifier.height(8.dp))
        Text(
            text = detail,
            style = MaterialTheme.typography.bodyMedium,
            color = c.textSecondary,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        if (actionLabel != null && onAction != null) {
            Spacer(Modifier.height(24.dp))
            PrimaryButton(
                label = actionLabel,
                onClick = onAction,
                modifier = Modifier.fillMaxWidth(0.72f),
            )
        }
    }
}
