package com.pinned.mobile.util

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.vosk.Model
import org.vosk.Recognizer
import org.vosk.android.RecognitionListener
import org.vosk.android.SpeechService
import org.vosk.android.storage.StorageService
import java.io.File
import java.io.FileOutputStream
import java.net.URL

/**
 * Wraps Vosk offline speech recognition into a simple state machine for the
 * quick-add voice capture flow. The Vosk model (~50MB) is downloaded once on
 * first use and cached in internal storage.
 *
 * Vosk is fully offline — no network, no API keys, no privacy concerns.
 */
class VoiceRecognizer(private val context: Context) {

    sealed interface State {
        data object Idle : State
        data object Loading : State
        data object Listening : State
        data class Done(val text: String) : State
        data class Error(val message: String) : State
    }

    private val _state = MutableStateFlow<State>(State.Idle)
    val state: StateFlow<State> = _state.asStateFlow()

    private var speechService: SpeechService? = null
    private var model: Model? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /** Begin listening. Downloads the model on first use, then starts recognition. */
    fun start() {
        if (_state.value == State.Listening || _state.value == State.Loading) return

        val modelDir = File(context.filesDir, VOSK_MODEL_DIR)
        if (modelDir.exists() && modelDir.list()?.isNotEmpty() == true) {
            startWithModel(modelDir)
        } else {
            _state.value = State.Loading
            scope.launch {
                try {
                    downloadModel(modelDir)
                    withContext(Dispatchers.Main) {
                        startWithModel(modelDir)
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to download Vosk model", e)
                    _state.value = State.Error("Failed to download speech model")
                }
            }
        }
    }

    private fun startWithModel(modelDir: File) {
        try {
            if (model == null) {
                model = Model(modelDir.absolutePath)
            }
            val recognizer = Recognizer(model, SAMPLE_RATE)
            val service = SpeechService(recognizer, SAMPLE_RATE)
            speechService = service

            service.startListening(object : RecognitionListener {
                override fun onPartialResult(hypothesis: String?) {
                    // Could show partial results, but we wait for final
                }

                override fun onResult(hypothesis: String?) {
                    val text = parseResult(hypothesis)
                    if (text.isNotBlank()) {
                        _state.value = State.Done(text)
                    } else {
                        _state.value = State.Error("Didn't catch that — try again")
                    }
                    stopService()
                }

                override fun onFinalResult(hypothesis: String?) {
                    val text = parseResult(hypothesis)
                    if (text.isNotBlank()) {
                        _state.value = State.Done(text)
                    } else {
                        _state.value = State.Error("Didn't catch that — try again")
                    }
                    stopService()
                }

                override fun onError(exception: Exception?) {
                    Log.e(TAG, "Vosk recognition error", exception)
                    _state.value = State.Error(exception?.message ?: "Recognition error")
                    stopService()
                }

                override fun onTimeout() {
                    _state.value = State.Error("No speech detected — try again")
                    stopService()
                }
            })

            _state.value = State.Listening
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start Vosk", e)
            _state.value = State.Error("Failed to start speech recognition")
        }
    }

    private fun parseResult(json: String?): String {
        if (json.isNullOrBlank()) return ""
        // Vosk returns JSON like: {"text": "hello world"}
        return try {
            org.json.JSONObject(json).optString("text", "").trim()
        } catch (e: Exception) {
            json
        }
    }

    private fun stopService() {
        speechService?.stop()
        speechService = null
    }

    /** Stop listening and reset to idle. Safe to call in any state. */
    fun cancel() {
        stopService()
        _state.value = State.Idle
    }

    /** Reset from [State.Done] or [State.Error] back to [State.Idle]. */
    fun reset() {
        _state.value = State.Idle
    }

    fun destroy() {
        cancel()
        model?.close()
        model = null
        scope.cancel()
    }

    private suspend fun downloadModel(targetDir: File) {
        targetDir.mkdirs()
        val zipFile = File(context.cacheDir, "vosk-model.zip")

        // Download the small English model (~50MB)
        URL(MODEL_URL).openStream().use { input ->
            FileOutputStream(zipFile).use { output ->
                input.copyTo(output)
            }
        }

        // Extract zip
        unzip(zipFile, targetDir)
        zipFile.delete()
    }

    private fun unzip(zipFile: File, targetDir: File) {
        val `in` = java.util.zip.ZipInputStream(zipFile.inputStream())
        var entry = `in`.nextEntry
        while (entry != null) {
            val file = File(targetDir, entry.name)
            if (entry.isDirectory) {
                file.mkdirs()
            } else {
                file.parentFile?.mkdirs()
                FileOutputStream(file).use { out ->
                    `in`.copyTo(out)
                }
            }
            `in`.closeEntry()
            entry = `in`.nextEntry
        }
        `in`.close()
    }

    companion object {
        private const val TAG = "VoiceRecognizer"
        private const val VOSK_MODEL_DIR = "vosk-model-en"
        private const val SAMPLE_RATE = 16000.0f
        // Vosk small English model — ~50MB, good accuracy for task phrases
        private const val MODEL_URL = "https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip"
    }
}
