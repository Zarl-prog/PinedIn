package com.pinned.mobile.util

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Wraps Android's platform [SpeechRecognizer] into a simple state machine for
 * the quick-add voice capture flow. Call [start] to begin listening; the
 * transcribed text appears via [State.Done] when recognition finishes.
 *
 * Uses the device's built-in speech service — no model download required.
 */
class VoiceRecognizer(private val context: Context) {

    sealed interface State {
        data object Idle : State
        data object Listening : State
        data class Done(val text: String) : State
        data class Error(val message: String) : State
    }

    private val _state = MutableStateFlow<State>(State.Idle)
    val state: StateFlow<State> = _state.asStateFlow()

    private var recognizer: SpeechRecognizer? = null

    /** Begin listening. Only call when [state] is [State.Idle]. */
    fun start() {
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            _state.value = State.Error("Speech recognition is not available on this device")
            return
        }

        recognizer?.destroy()
        val sr = SpeechRecognizer.createSpeechRecognizer(context)
        recognizer = sr

        sr.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {
                _state.value = State.Listening
            }

            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}

            override fun onError(error: Int) {
                val msg = when (error) {
                    SpeechRecognizer.ERROR_NO_MATCH -> "Didn't catch that — try again"
                    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech detected"
                    SpeechRecognizer.ERROR_AUDIO -> "Audio recording error"
                    SpeechRecognizer.ERROR_CLIENT -> "Client error"
                    SpeechRecognizer.ERROR_NETWORK,
                    SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Network error"
                    SpeechRecognizer.ERROR_SERVER -> "Server error"
                    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Recognizer is busy"
                    else -> "Recognition error ($error)"
                }
                _state.value = State.Error(msg)
                sr.destroy()
                recognizer = null
            }

            override fun onResults(results: Bundle?) {
                val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                val text = matches?.firstOrNull().orEmpty()
                _state.value = if (text.isNotBlank()) State.Done(text) else State.Error("Didn't catch that — try again")
                sr.destroy()
                recognizer = null
            }

            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-US")
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
        }

        sr.startListening(intent)
    }

    /** Stop listening and reset to idle. Safe to call in any state. */
    fun cancel() {
        recognizer?.cancel()
        recognizer?.destroy()
        recognizer = null
        _state.value = State.Idle
    }

    /** Reset from [State.Done] or [State.Error] back to [State.Idle]. */
    fun reset() {
        _state.value = State.Idle
    }

    /** Release the recognizer and stop listening. Safe to call in any state. */
    fun destroy() {
        cancel()
    }
}
