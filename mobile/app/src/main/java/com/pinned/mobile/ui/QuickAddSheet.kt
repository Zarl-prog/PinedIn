package com.pinned.mobile.ui

import android.Manifest
import android.app.DatePickerDialog
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.pinned.mobile.data.WORKSPACES
import com.pinned.mobile.ui.components.ChoiceChip
import com.pinned.mobile.ui.components.PrimaryButton
import com.pinned.mobile.ui.theme.PinnedShape
import com.pinned.mobile.ui.theme.PinnedTheme
import com.pinned.mobile.util.VoiceRecognizer
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter

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
    availableTags: List<String>,
    initialText: String = "",
    autoStartVoice: Boolean = false,
    onSave: (text: String, workspace: String, tags: String, dueAt: String?) -> Unit,
    onDismiss: () -> Unit,
) {
    val c = PinnedTheme.colors
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    val focusRequester = remember { FocusRequester() }
    val keyboard = LocalSoftwareKeyboardController.current
    val context = LocalContext.current

    var field by remember { mutableStateOf(TextFieldValue(initialText, TextRange(initialText.length))) }
    var workspace by remember(defaultWorkspace) { mutableStateOf(defaultWorkspace) }
    var selectedTags by remember { mutableStateOf(setOf<String>()) }
    var dueDate: LocalDate? by remember { mutableStateOf(null) }
    val canSave = field.text.isNotBlank()

    val formatter = remember { DateTimeFormatter.ofPattern("MMM d") }

    fun showDatePicker() {
        val now = LocalDate.now()
        val initial = dueDate ?: now
        DatePickerDialog(
            context,
            { _, year, month, day ->
                dueDate = LocalDate.of(year, month + 1, day)
            },
            initial.year,
            initial.monthValue - 1,
            initial.dayOfMonth,
        ).apply {
            datePicker.minDate = System.currentTimeMillis()
            show()
        }
    }

    // Voice recognizer
    val recognizer = remember { VoiceRecognizer(context) }
    val voiceState by recognizer.state.collectAsState()

    // Handle voice recognition results
    LaunchedEffect(voiceState) {
        when (val s = voiceState) {
            is VoiceRecognizer.State.Done -> {
                field = TextFieldValue(s.text, TextRange(s.text.length))
                recognizer.reset()
            }
            is VoiceRecognizer.State.Error -> {
                recognizer.reset()
            }
            else -> {}
        }
    }

    val isListening = voiceState is VoiceRecognizer.State.Listening
    val isLoading = voiceState is VoiceRecognizer.State.Loading

    // Permission launcher for RECORD_AUDIO
    var micPermissionGranted by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
                PackageManager.PERMISSION_GRANTED
        )
    }
    val micPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        micPermissionGranted = granted
        if (granted) recognizer.start()
    }

    fun toggleVoice() {
        when (voiceState) {
            is VoiceRecognizer.State.Listening -> recognizer.cancel()
            else -> {
                if (micPermissionGranted) {
                    recognizer.start()
                } else {
                    micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                }
            }
        }
    }

    // Cleanup on dismiss
    DisposableEffect(Unit) {
        onDispose { recognizer.destroy() }
    }

    fun save() {
        if (!canSave) return
        val dueAtIso = dueDate?.atStartOfDay(ZoneId.systemDefault())?.toInstant()?.let {
            java.time.format.DateTimeFormatter.ISO_INSTANT.format(it)
        }
        onSave(field.text, workspace, selectedTags.joinToString(","), dueAtIso)
        if (keepOpenAfterSave) {
            field = TextFieldValue("", TextRange.Zero)
            selectedTags = emptySet()
            dueDate = null
        } else {
            onDismiss()
        }
    }

    LaunchedEffect(Unit) {
        focusRequester.requestFocus()
        keyboard?.show()
    }

    LaunchedEffect(autoStartVoice) {
        if (autoStartVoice && !isListening && !isLoading) {
            if (micPermissionGranted) {
                recognizer.start()
            } else {
                micPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
            }
        }
    }

    ModalBottomSheet(
        onDismissRequest = {
            recognizer.cancel()
            onDismiss()
        },
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
            // Text field with mic button
            Row(
                verticalAlignment = Alignment.Top,
                modifier = Modifier.fillMaxWidth(),
            ) {
                BasicTextField(
                    value = field,
                    onValueChange = { field = it },
                    textStyle = MaterialTheme.typography.bodyLarge.copy(color = c.textPrimary),
                    cursorBrush = SolidColor(c.accent),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
                    keyboardActions = KeyboardActions(onDone = { save() }),
                    modifier = Modifier
                        .weight(1f)
                        .defaultMinSize(minHeight = 100.dp)
                        .clip(PinnedShape.field)
                        .background(c.bgInput)
                        .border(1.5.dp, c.accentRing, PinnedShape.field)
                        .focusRequester(focusRequester)
                        .padding(horizontal = 16.dp, vertical = 16.dp),
                    decorationBox = { inner ->
                        Box(contentAlignment = Alignment.TopStart) {
                            when {
                                voiceState is VoiceRecognizer.State.Listening -> {
                                    Text(
                                        text = "Listening…",
                                        style = MaterialTheme.typography.bodyLarge,
                                        color = c.accent,
                                    )
                                }
                                voiceState is VoiceRecognizer.State.Loading -> {
                                    Text(
                                        text = "Downloading speech model…",
                                        style = MaterialTheme.typography.bodyLarge,
                                        color = c.textMuted,
                                    )
                                }
                                field.text.isEmpty() -> {
                                    Text(
                                        text = "Jot something down…",
                                        style = MaterialTheme.typography.bodyLarge,
                                        color = c.textMuted,
                                    )
                                }
                            }
                            inner()
                        }
                    },
                )

                // Mic button
                val micColor by animateColorAsState(
                    targetValue = when {
                        isListening -> c.accent
                        isLoading -> c.textMuted
                        else -> c.textMuted
                    },
                    label = "mic-color",
                )

                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .padding(start = 8.dp, top = 8.dp)
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(
                            when {
                                isListening -> c.accent.copy(alpha = 0.15f)
                                isLoading -> c.bgBadge
                                else -> c.bgInput
                            }
                        )
                        .border(
                            1.dp,
                            when {
                                isListening -> c.accent.copy(alpha = 0.4f)
                                isLoading -> c.border
                                else -> c.border
                            },
                            CircleShape,
                        )
                        .clickable(enabled = !isListening && !isLoading) { toggleVoice() },
                ) {
                    when {
                        isListening -> {
                            CircularProgressIndicator(
                                color = c.accent,
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                        isLoading -> {
                            CircularProgressIndicator(
                                color = c.textMuted,
                                strokeWidth = 2.dp,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                        else -> {
                            Icon(
                                imageVector = Icons.Filled.Mic,
                                contentDescription = "Voice capture",
                                tint = micColor,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // Due date row
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(PinnedShape.field)
                    .background(c.bgInput)
                    .border(1.dp, if (dueDate != null) c.accentRing else c.border, PinnedShape.field)
                    .clickable { showDatePicker() }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            ) {
                Icon(
                    imageVector = Icons.Filled.CalendarToday,
                    contentDescription = "Set due date",
                    tint = if (dueDate != null) c.accent else c.textMuted,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(8.dp))
                if (dueDate != null) {
                    Text(
                        text = "Due ${dueDate!!.format(formatter)}",
                        style = MaterialTheme.typography.bodyMedium,
                        color = c.accent,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        imageVector = Icons.Filled.Close,
                        contentDescription = "Clear due date",
                        tint = c.textMuted,
                        modifier = Modifier
                            .size(18.dp)
                            .clickable { dueDate = null },
                    )
                } else {
                    Text(
                        text = "Set due date (optional)",
                        style = MaterialTheme.typography.bodyMedium,
                        color = c.textMuted,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            Spacer(Modifier.height(12.dp))

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

            if (availableTags.isNotEmpty()) {
                Spacer(Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    availableTags.forEach { tag ->
                        val isSelected = tag in selectedTags
                        ChoiceChip(
                            label = tag,
                            selected = isSelected,
                            onClick = {
                                selectedTags = if (isSelected) {
                                    selectedTags - tag
                                } else {
                                    selectedTags + tag
                                }
                            },
                        )
                    }
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
