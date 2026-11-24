package com.mimiai.assistant

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.MediaPlayer
import android.os.Bundle
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .build()

    private val defaultBaseUrl = "https://ais-pre-uuzky3ypgmgghwvfuuhcqc-347265722576.asia-east1.run.app"
    private lateinit var controller: PhoneController
    private var speechRecognizer: SpeechRecognizer? = null
    private var mediaPlayer: MediaPlayer? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        controller = PhoneController(this)
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.CALL_PHONE,
                Manifest.permission.CAMERA
            )
        )

        setContent {
            val scope = rememberCoroutineScope()
            var baseUrl by remember { mutableStateOf(defaultBaseUrl) }
            var commandInput by remember { mutableStateOf("") }
            var status by remember { mutableStateOf("Tap Mic & speak in Hinglish or Hindi") }
            var reply by remember { mutableStateOf("Hii! Main Mimi hoon. Bolo aaj kya karoon?") }
            var listening by remember { mutableStateOf(false) }
            var busy by remember { mutableStateOf(false) }
            var showDebugPanel by remember { mutableStateOf(true) }

            val accessibilityEnabled = MimiAccessibilityService.instance != null
            val writeSettingsGranted = Settings.System.canWrite(this@MainActivity)
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val dndGranted = nm.isNotificationPolicyAccessGranted

            val coral = Color(0xFFE11D48)

            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = coral,
                    surface = Color(0xFFFAF8F7),
                    background = Color(0xFFFAF8F7)
                )
            ) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text("Mimi AI", style = MaterialTheme.typography.headlineSmall)
                                Text(
                                    text = status,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = Color(0xFF57534E)
                                )
                            }
                            TextButton(onClick = { showDebugPanel = !showDebugPanel }) {
                                Text(if (showDebugPanel) "Hide Debug" else "Debug Info")
                            }
                        }

                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(containerColor = Color.White)
                        ) {
                            Text(
                                text = reply,
                                modifier = Modifier.padding(18.dp),
                                style = MaterialTheme.typography.bodyLarge
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedTextField(
                                value = commandInput,
                                onValueChange = { commandInput = it },
                                placeholder = { Text("Type command (e.g. Flashlight on karo)") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            Button(
                                onClick = {
                                    val cmd = commandInput.trim()
                                    if (cmd.isNotEmpty() && !busy) {
                                        commandInput = ""
                                        busy = true
                                        status = "You: $cmd"
                                        scope.launch {
                                            reply = askMimiAndSpeak(baseUrl, cmd)
                                            status = "Done"
                                            busy = false
                                        }
                                    }
                                },
                                enabled = !busy && commandInput.isNotBlank(),
                                modifier = Modifier.height(56.dp)
                            ) {
                                Text("Send")
                            }
                        }

                        Button(
                            onClick = {
                                if (listening) {
                                    speechRecognizer?.stopListening()
                                    listening = false
                                    return@Button
                                }
                                listening = true
                                status = "Sun rahi hoon..."
                                startVoiceInput { spokenText ->
                                    listening = false
                                    if (spokenText.isBlank()) {
                                        status = "Could not hear clearly. Try again."
                                        return@startVoiceInput
                                    }
                                    status = "You: $spokenText"
                                    busy = true
                                    scope.launch {
                                        reply = askMimiAndSpeak(baseUrl, spokenText)
                                        status = "Ready"
                                        busy = false
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(54.dp)
                        ) {
                            Text(
                                when {
                                    listening -> "Listening... (Tap to stop)"
                                    busy -> "Mimi is thinking..."
                                    else -> "Speak to Mimi (Hinglish / Hindi)"
                                }
                            )
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        busy = true
                                        reply = askMimiAndSpeak(baseUrl, "Flashlight on karo")
                                        busy = false
                                    }
                                },
                                modifier = Modifier.weight(1f)
                            ) { Text("Torch ON") }

                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        busy = true
                                        reply = askMimiAndSpeak(baseUrl, "Brightness 40% kar do")
                                        busy = false
                                    }
                                },
                                modifier = Modifier.weight(1f)
                            ) { Text("Bright 40%") }
                        }

                        if (showDebugPanel) {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFFF5F2F0))
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Text(
                                        "Direct Debugging & Permissions",
                                        style = MaterialTheme.typography.titleSmall
                                    )
                                    Text(
                                        "Accessibility: ${if (accessibilityEnabled) "Connected" else "Off"} · " +
                                            "Write Settings: ${if (writeSettingsGranted) "Granted" else "Off"} · " +
                                            "DND: ${if (dndGranted) "Granted" else "Off"}",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                    OutlinedTextField(
                                        value = baseUrl,
                                        onValueChange = { baseUrl = it },
                                        label = { Text("Backend API URL") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                    OutlinedButton(
                                        onClick = {
                                            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text("1. Enable Accessibility Service")
                                    }
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        OutlinedButton(
                                            onClick = { controller.openWriteSettings() },
                                            modifier = Modifier.weight(1f)
                                        ) { Text("2. Brightness Perm") }
                                        OutlinedButton(
                                            onClick = { controller.openDndSettings() },
                                            modifier = Modifier.weight(1f)
                                        ) { Text("3. Silent / DND Perm") }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private fun startVoiceInput(onResult: (String) -> Unit) {
        speechRecognizer?.destroy()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(this)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
        }
        speechRecognizer?.setRecognitionListener(object : RecognitionListener {
            override fun onResults(results: Bundle?) {
                val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                onResult(text ?: "")
            }
            override fun onError(error: Int) { onResult("") }
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onPartialResults(partialResults: Bundle?) {}
            override fun onEvent(eventType: Int, params: Bundle?) {}
        })
        speechRecognizer?.startListening(intent)
    }

    private suspend fun askMimiAndSpeak(serverUrl: String, command: String): String =
        withContext(Dispatchers.IO) {
            val cleanBase = serverUrl.trim().removeSuffix("/")
            val jsonMedia = "application/json; charset=utf-8".toMediaType()
            val payload = JSONObject().put("message", command).toString()
            val req = Request.Builder()
                .url("$cleanBase/api/assistant")
                .post(payload.toRequestBody(jsonMedia))
                .build()

            val respBody = runCatching {
                client.newCall(req).execute().use { it.body?.string() }
            }.getOrNull() ?: return@withContext "Server se connect nahi ho paya. URL check karo."

            val json = runCatching { JSONObject(respBody) }.getOrNull()
                ?: return@withContext "Invalid response from server."
            val replyText = json.optString("replyText", "Done!")

            withContext(Dispatchers.Main) {
                controller.applyAssistantResponse(json)
            }

            val ttsPayload = JSONObject()
                .put("text", replyText)
                .put("persona", "bubbly")
                .toString()
            val ttsReq = Request.Builder()
                .url("$cleanBase/api/tts")
                .post(ttsPayload.toRequestBody(jsonMedia))
                .build()

            val ttsResp = runCatching {
                client.newCall(ttsReq).execute().use { it.body?.string() }
            }.getOrNull()

            if (ttsResp != null) {
                val audioBase64 = runCatching { JSONObject(ttsResp).optString("audioBase64", "") }
                    .getOrDefault("")
                if (audioBase64.isNotEmpty()) {
                    val wavBytes = Base64.decode(audioBase64, Base64.DEFAULT)
                    val tempWav = File(cacheDir, "mimi_reply.wav")
                    tempWav.writeBytes(wavBytes)
                    withContext(Dispatchers.Main) {
                        mediaPlayer?.release()
                        mediaPlayer = MediaPlayer().apply {
                            setDataSource(tempWav.absolutePath)
                            prepare()
                            start()
                        }
                    }
                }
            }
            replyText
        }

    override fun onDestroy() {
        super.onDestroy()
        speechRecognizer?.destroy()
        mediaPlayer?.release()
    }
}
