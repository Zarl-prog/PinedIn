package com.pinned.mobile.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import com.pinned.mobile.data.WORKSPACES
import com.pinned.mobile.ui.components.ChoiceChip
import com.pinned.mobile.ui.components.PrimaryButton
import com.pinned.mobile.ui.theme.PinnedShape
import com.pinned.mobile.ui.theme.PinnedTheme

/**
 * The quick-add sheet. Opens with the keyboard already up and the cursor placed —
 * the whole point of the app is getting a thought down before it evaporates.
 *
 * When "keep open" is on, saving clears the field and leaves the sheet up so several
 * things can be jotted in a row.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuickAddSheet(
    defaultWorkspace: String,
    keepOpenAfterSave: Boolean,
    onSave: (text: String, workspace: String) -> Unit,
    onDismiss: () -> Unit,
) {
    val c = PinnedTheme.colors
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val focusRequester = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current

    var field by remember { mutableStateOf(TextFieldValue("")) }
    var workspace by remember(defaultWorkspace) { mutableStateOf(defaultWorkspace) }
    val canSave = field.text.isNotBlank()

    fun save() {
        if (!canSave) return
        onSave(field.text, workspace)
        if (keepOpenAfterSave) {
            field = TextFieldValue("", TextRange.Zero)
        } else {
            onDismiss()
        }
    }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
        keyboard?.show()
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = c.bgFloat,
        contentColor = c.textPrimary,
        shape = PinnedShape.sheet,
        dragHandle = {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .width(40.dp)
                        .height(4.dp)
                        .clip(PinnedShape.pill)
                        .background(c.borderLight),
                )
            }
        },
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .navigationBarsPadding()
                .padding(horizontal = 16.dp)
                .padding(bottom = 20.dp),
        ) {
            BasicTextField(
                value = field,
                onValueChange = { field = it },
                textStyle = MaterialTheme.typography.bodyLarge.copy(color = c.textPrimary),
                cursorBrush = SolidColor(c.accent),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                keyboardActions = KeyboardActions(onDone = { save() }),
                modifier = Modifier
                    .fillMaxWidth()
                    .defaultMinSize(minHeight = 100.dp)
                    .clip(PinnedShape.field)
                    .background(c.bgInput)
                    .border(1.5.dp, c.accentRing, PinnedShape.field)
                    .focusRequester(focusRequester)
                    .padding(horizontal = 16.dp, vertical = 16.dp),
                decorationBox = { inner ->
                    Box(contentAlignment = Alignment.TopStart) {
                        if (field.text.isEmpty()) {
                            Text(
                                text = "Jot something down…",
                                style = MaterialTheme.typography.bodyLarge,
                                color = c.textMuted,
                            )
                        }
                        inner()
                    }
                },
            )

            Spacer(Modifier.height(16.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                WORKSPACES.forEach { name ->
                    ChoiceChip(
                        label = name,
                        selected = name == workspace,
                        onClick = { workspace = name },
                    )
                }
            }

            Spacer(Modifier.height(18.dp))

            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    text = "Saved locally · syncs on next scan",
                    style = MaterialTheme.typography.bodySmall,
                    color = c.textMuted,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(12.dp))
                PrimaryButton(
                    label = "Add",
                    enabled = canSave,
                    onClick = { save() },
                    modifier = Modifier.width(110.dp),
                )
            }
        }
    }
}
