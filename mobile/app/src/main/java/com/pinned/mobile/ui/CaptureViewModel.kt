package com.pinned.mobile.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.pinned.mobile.PinnedWidgetProvider
import com.pinned.mobile.data.CaptureRepository
import com.pinned.mobile.data.CapturedTask
import com.pinned.mobile.data.PinnedDatabase
import com.pinned.mobile.data.Prefs
import com.pinned.mobile.sync.HttpSyncClient
import com.pinned.mobile.sync.PairingInfo
import com.pinned.mobile.sync.SyncClient
import com.pinned.mobile.sync.SyncResult
import com.pinned.mobile.sync.isExpired
import com.pinned.mobile.util.nowIsoUtc
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CaptureUiState(
    val tasks: List<CapturedTask> = emptyList(),
    val unsyncedCount: Int = 0,
    val defaultWorkspace: String = "work",
    val keepComposerOpen: Boolean = true,
    val lastSyncAt: String? = null,
    val syncing: Boolean = false,
    val useLightTheme: Boolean = false,
    /** Tags available for selection — kept on the ViewModel so the UI can pick. */
    val availableTags: List<String> = listOf("urgent", "later", "idea", "errand"),
) {
    val pending: List<CapturedTask> get() = tasks.filter { !it.synced }
    val synced: List<CapturedTask> get() = tasks.filter { it.synced }
}

/** The outcome of the most recent scan-and-push, held until the user dismisses it. */
data class SyncOutcome(
    val result: SyncResult,
    val pairing: PairingInfo?,
    val leftUnsynced: Int,
)

class CaptureViewModel(app: Application) : AndroidViewModel(app) {

    private val repo = CaptureRepository(PinnedDatabase.get(app).capturedTaskDao())
    private val prefs = Prefs(app)

    /**
     * The real network path. Kept as a `var` so a test or a `@Preview` can drop in a
     * fake that returns a canned [SyncResult] without touching WiFi.
     */
    var syncClient: SyncClient = HttpSyncClient()

    private val _state = MutableStateFlow(
        CaptureUiState(
            defaultWorkspace = prefs.defaultWorkspace,
            keepComposerOpen = prefs.keepComposerOpen,
            lastSyncAt = prefs.lastSyncAt,
            useLightTheme = prefs.useLightTheme,
        ),
    )
    val state: StateFlow<CaptureUiState> = _state.asStateFlow()

    private val _outcome = MutableStateFlow<SyncOutcome?>(null)
    val outcome: StateFlow<SyncOutcome?> = _outcome.asStateFlow()

    init {
        viewModelScope.launch {
            repo.tasks.collect { list -> _state.update { it.copy(tasks = list) } }
        }
        viewModelScope.launch {
            repo.unsyncedCount.collect { n -> _state.update { it.copy(unsyncedCount = n) } }
        }
    }

    fun capture(text: String, workspace: String, tags: String = "", dueAt: String? = null) {
        viewModelScope.launch { repo.capture(text, workspace, tags, dueAt) }
    }

    fun delete(id: String) {
        viewModelScope.launch { repo.delete(id) }
    }

    fun setDefaultWorkspace(workspace: String) {
        prefs.defaultWorkspace = workspace
        _state.update { it.copy(defaultWorkspace = workspace) }
    }

    fun setKeepComposerOpen(enabled: Boolean) {
        prefs.keepComposerOpen = enabled
        _state.update { it.copy(keepComposerOpen = enabled) }
    }

    fun setUseLightTheme(enabled: Boolean) {
        prefs.useLightTheme = enabled
        _state.update { it.copy(useLightTheme = enabled) }
    }

    fun clearSyncedHistory() {
        viewModelScope.launch { repo.clearSynced() }
    }

    /**
     * Called with the decoded QR payload. Pushes everything still unsynced and
     * records the outcome for the result screen. The token expiry is checked here
     * too so an old screenshot fails immediately instead of after a network round
     * trip — the desktop re-checks it regardless.
     *
     * If the push fails due to a network error (not a 401), the task stays
     * unsynced and will be retried on the next scan — the "offline queue" pattern.
     */
    fun syncWith(pairing: PairingInfo) {
        if (_state.value.syncing) return
        viewModelScope.launch {
            _state.update { it.copy(syncing = true) }
            val batch = repo.pending()
            val result = when {
                batch.isEmpty() -> SyncResult.NothingToSync
                pairing.isExpired() -> SyncResult.Failure("That code has expired — generate a new one")
                else -> {
                    var lastError: SyncResult.Failure? = null
                    var attempts = 0
                    val maxAttempts = 3

                    while (attempts < maxAttempts) {
                        attempts++
                        when (val r = syncClient.push(pairing, batch)) {
                            is SyncResult.Success -> {
                                repo.markSynced(batch.map { it.id })
                                val stamp = nowIsoUtc()
                                prefs.lastSyncAt = stamp
                                _state.update { it.copy(lastSyncAt = stamp) }
                                PinnedWidgetProvider.updateAll(app)
                                lastError = null
                                break
                            }
                            is SyncResult.Failure -> {
                                lastError = r
                                if (attempts < maxAttempts) {
                                    delay(1000L * attempts)
                                }
                            }
                            is SyncResult.NothingToSync -> break
                        }
                    }
                    lastError ?: SyncResult.Success(batch.size)
                }
            }
            _outcome.value = SyncOutcome(
                result = result,
                pairing = pairing,
                leftUnsynced = repo.pending().size,
            )
            _state.update { it.copy(syncing = false) }
        }
    }

    fun dismissOutcome() {
        _outcome.value = null
    }
}
