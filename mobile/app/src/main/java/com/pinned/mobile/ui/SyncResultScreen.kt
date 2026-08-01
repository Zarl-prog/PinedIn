package com.pinned.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.pinned.mobile.sync.SyncResult
import com.pinned.mobile.sync.secondsLeft
import com.pinned.mobile.ui.components.PrimaryButton
import com.pinned.mobile.ui.theme.PinnedShape
import com.pinned.mobile.ui.theme.PinnedTheme

/**
 * Shown while the phone POSTs the pending batch after a successful QR scan —
 * avoids flashing back to Capture with no feedback.
 */
@Composable
fun SyncingScreen() {
    val c = PinnedTheme.colors
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
        modifier = Modifier
            .fillMaxSize()
            .background(c.bgApp)
            .padding(horizontal = 32.dp),
    ) {
        CircularProgressIndicator(
            color = c.accent,
            strokeWidth = 3.dp,
            modifier = Modifier.size(48.dp),
        )
        Spacer(Modifier.height(28.dp))
        Text(
            text = "Sending to laptop…",
            style = MaterialTheme.typography.titleMedium,
            color = c.textPrimary,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(10.dp))
        Text(
            text = "Stay on this WiFi — the pairing code only lasts about a minute.",
            style = MaterialTheme.typography.bodyMedium,
            color = c.textSecondary,
            textAlign = TextAlign.Center,
        )
    }
}

/**
 * The receipt for one sync. It states plainly where the data went and what is left
 * over, because there is no other way to check — the listener on the laptop is
 * already gone by the time this renders.
 */
@Composable
fun SyncResultScreen(outcome: SyncOutcome, onDone: () -> Unit) {
    val c = PinnedTheme.colors
    val result = outcome.result
    val ok = result is SyncResult.Success
    val tint = when (result) {
        is SyncResult.Failure -> c.textDanger
        SyncResult.NothingToSync -> c.textSecondary
        is SyncResult.Success -> c.success
    }
    val ringBg = when (result) {
        is SyncResult.Failure -> c.textDanger.copy(alpha = 0.12f)
        SyncResult.NothingToSync -> c.bgBadge
        is SyncResult.Success -> c.successSoft
    }
    val ringBorder = when (result) {
        is SyncResult.Failure -> c.textDanger.copy(alpha = 0.4f)
        SyncResult.NothingToSync -> c.borderLight
        is SyncResult.Success -> c.success.copy(alpha = 0.45f)
    }

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .fillMaxSize()
            .background(c.bgApp)
            .padding(horizontal = 28.dp),
    ) {
        Spacer(Modifier.weight(1f))

        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(84.dp)
                .clip(CircleShape)
                .background(ringBg)
                .border(2.dp, ringBorder, CircleShape),
        ) {
            Icon(
                imageVector = if (result is SyncResult.Failure) Icons.Filled.Close else Icons.Filled.Check,
                contentDescription = null,
                tint = tint,
                modifier = Modifier.size(34.dp),
            )
        }

        Spacer(Modifier.height(24.dp))

        Text(
            text = headline(result),
            style = MaterialTheme.typography.titleLarge,
            color = c.textPrimary,
            textAlign = TextAlign.Center,
        )

        if (result is SyncResult.Failure) {
            Spacer(Modifier.height(10.dp))
            Text(
                text = result.reason,
                style = MaterialTheme.typography.bodyMedium,
                color = c.textSecondary,
                textAlign = TextAlign.Center,
            )
        }

        Spacer(Modifier.height(28.dp))

        Column(
            verticalArrangement = Arrangement.spacedBy(0.dp),
            modifier = Modifier
                .fillMaxWidth()
                .clip(PinnedShape.card)
                .background(c.bgCard)
                .border(1.dp, c.border, PinnedShape.card)
                .padding(vertical = 6.dp),
        ) {
            val pairing = outcome.pairing
            if (pairing != null) {
                ReceiptRow("Sent to", "${pairing.host}:${pairing.port}")
                val left = pairing.secondsLeft()
                ReceiptRow(
                    label = "Pairing code",
                    value = if (left > 0) "verified · ${left}s left" else "expired",
                )
            }
            ReceiptRow("Listener", "closed on the laptop")
            ReceiptRow(
                label = "Left unsynced",
                value = outcome.leftUnsynced.toString(),
                valueColor = if (outcome.leftUnsynced > 0) c.accent else null,
            )
        }

        Spacer(Modifier.weight(1f))

        PrimaryButton(
            label = "Done",
            onClick = onDone,
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(28.dp))
    }
}

private fun headline(result: SyncResult): String = when (result) {
    is SyncResult.Success -> if (result.count == 1) "1 task sent" else "${result.count} tasks sent"
    SyncResult.NothingToSync -> "Nothing to send"
    is SyncResult.Failure -> "Sync failed"
}

@Composable
private fun ReceiptRow(label: String, value: String, valueColor: Color? = null) {
    val c = PinnedTheme.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = c.textSecondary,
        )
        Spacer(Modifier.width(12.dp))
        Spacer(Modifier.weight(1f))
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
            color = valueColor ?: c.textPrimary,
        )
    }
}
