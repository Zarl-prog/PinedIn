package com.pinned.mobile.sync

import com.pinned.mobile.data.CapturedTask
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit

/**
 * The one network call this app makes: a single POST of the whole unsynced batch
 * straight to the laptop on the local network.
 *
 * Timeouts are deliberately short. Both devices are on the same WiFi and the
 * listener on the other end only lives for the length of one sync, so a request
 * that hasn't connected within a few seconds is not going to succeed at all —
 * better to fail while the user is still holding the phone up than to hang.
 */
class HttpSyncClient(
    private val client: OkHttpClient = defaultClient(),
) : SyncClient {

    override suspend fun push(pairing: PairingInfo, tasks: List<CapturedTask>): SyncResult =
        withContext(Dispatchers.IO) {
            val body = encode(tasks).toString().toRequestBody(JSON)
            val request = Request.Builder()
                .url(pairing.url)
                .addHeader("X-Pinned-Token", pairing.token)
                .post(body)
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    when {
                        response.isSuccessful -> SyncResult.Success(tasks.size)
                        // The desktop rejects an expired or unknown token with 401.
                        response.code == 401 ->
                            SyncResult.Failure("That code has expired — generate a new one")
                        else ->
                            SyncResult.Failure("The laptop refused the batch (HTTP ${response.code})")
                    }
                }
            } catch (e: SocketTimeoutException) {
                SyncResult.Failure("The laptop didn't answer — is Pinned still showing the code?")
            } catch (e: IOException) {
                SyncResult.Failure("Couldn't reach ${pairing.host} — check you're on the same WiFi")
            }
        }

    /**
     * Builds the payload contract from the plan: a flat JSON array, one object per
     * task. [CapturedTask.synced] and [CapturedTask.syncedAt] are phone-side
     * bookkeeping and deliberately not sent.
     */
    private fun encode(tasks: List<CapturedTask>): JSONArray {
        val array = JSONArray()
        tasks.forEach { task ->
            array.put(
                JSONObject().apply {
                    put("id", task.id)
                    put("text", task.text)
                    put("created_at", task.createdAt)
                    put("workspace", task.workspace)
                    if (task.tags.isNotBlank()) {
                        put("tags", task.tags)
                    }
                },
            )
        }
        return array
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()

        private fun defaultClient(): OkHttpClient = OkHttpClient.Builder()
            .connectTimeout(4, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .retryOnConnectionFailure(false)
            .build()
    }
}
