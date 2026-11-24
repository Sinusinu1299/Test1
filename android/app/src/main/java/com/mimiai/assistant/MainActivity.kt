package com.mimiai.assistant

import android.Manifest
import android.app.NotificationManager
import android.content.ClipData
import android.content.ClipboardManager
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
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
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

    private val voiceModes = listOf(
        "all_in_one" to "All-in-One",
        "jaan" to "Jaan",
        "friendly" to "Friendly",
        "flirty" to "Flirty",
        "bubbly" to "Bubbly",
        "calm" to "Soft"
    )

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
            val lifecycleOwner = LocalLifecycleOwner.current

            var baseUrl by remember { mutableStateOf(defaultBaseUrl) }
            var commandInput by remember { mutableStateOf("") }
            var selectedPersona by remember { mutableStateOf("all_in_one") }
            var status by remember { mutableStateOf("All-in-One Girl Voice · Hinglish & Hindi") }
            var reply by remember { mutableStateOf("Hii Jaan! Main Mimi hoon — All-in-One mode mein. Bolo kya karoon?") }
            var debugLog by remember { mutableStateOf("Ready for GitHub & ADB Debug") }
            var listening by remember { mutableStateOf(false) }
            var busy by remember { mutableStateOf(false) }
            var showDebugPanel by remember { mutableStateOf(true) }
            var blackMode by remember { mutableStateOf(true) }

            var accessibilityEnabled by remember { mutableStateOf(MimiAccessibilityService.instance != null) }
            var writeSettingsGranted by remember { mutableStateOf(Settings.System.canWrite(this@MainActivity)) }
            var dndGranted by remember {
                mutableStateOf(
                    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                        .isNotificationPolicyAccessGranted
                )
            }

            DisposableEffect(lifecycleOwner) {
                val observer = LifecycleEventObserver { _, event ->
                    if (event == Lifecycle.Event.ON_RESUME) {
                        accessibilityEnabled = MimiAccessibilityService.instance != null
                        writeSettingsGranted = Settings.System.canWrite(this@MainActivity)
                        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                        dndGranted = nm.isNotificationPolicyAccessGranted
                    }
                }
                lifecycleOwner.lifecycle.addObserver(observer)
                onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
            }

            val coral = Color(0xFFE11D48)
            val colorScheme = if (blackMode) {
                darkColorScheme(
                    primary = Color(0xFFF43F5E),
                    background = Color(0xFF09090B),
                    surface = Color(0xFF09090B),
                    surfaceVariant = Color(0xFF141418),
                    onBackground = Color(0xFFFAFAFA),
                    onSurface = Color(0xFFFAFAFA)
                )
            } else {
                lightColorScheme(
                    primary = coral,
                    background = Color(0xFFFAF8F7),
                    surface = Color(0xFFFAF8F7),
                    surfaceVariant = Color(0xFFF3EFEF)
                )
            }

            MaterialTheme(colorScheme = colorScheme) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .verticalScroll(rememberScrollState())
                            .padding(20.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Mimi AI", style = MaterialTheme.typography.headlineSmall)
                                Text(
                                    text = status,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = if (blackMode) Color(0xFFA1A1AA) else Color(0xFF57534E)
                                )
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                TextButton(onClick = { blackMode = !blackMode }) {
                                    Text(if (blackMode) "Light" else "Black")
                                }
                                TextButton(onClick = { showDebugPanel = !showDebugPanel }) {
                                    Text(if (showDebugPanel) "Hide Debug" else "Debug")
                                }
                            }
                        }

                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            voiceModes.forEach { (id, label) ->
                                val isSelected = selectedPersona == id
                                val onSelect: () -> Unit = {
                                    selectedPersona = id
                                    reply = when (id) {
                                        "jaan" -> "Hii meri Jaan! Main hamesha aapke saath hoon. Bolo kya karoon?"
                                        "friendly" -> "Heyy bestie! Chill karo, bolo phone mein kya set karna hai?"
                                        "flirty" -> "Hii handsome! Aaj bade pyaar se yaad kiya? Bolo kya command hai!"
                                        "bubbly" -> "Hii! Main Mimi hoon — bolo aaj kya karna hai?"
                                        "calm" -> "Hello... aaram se bolo, main pyaar se kar doongi."
                                        else -> "Hii Jaan! All-in-One mode ready hai — Friendly, Flirty ya Phone Control, bolo!"
                                    }
                                }
                                if (isSelected) {
                                    Button(
                                        onClick = onSelect,
                                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                                    ) { Text(label) }
                                } else {
                                    OutlinedButton(
                                        onClick = onSelect,
                                        contentPadding = PaddingValues(horizontal = 14.dp, vertical = 6.dp)
                                    ) { Text(label) }
                                }
                            }
                        }

                        Card(
                            modifier = Modifier.fillMaxWidth(),
                            colors = CardDefaults.cardColors(
                                containerColor = if (blackMode) Color(0xFF141418) else Color.White
                            )
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
                                            val res = askMimiAndSpeak(baseUrl, cmd, selectedPersona)
                                            reply = res.first
                                            debugLog = res.second
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
                                        val res = askMimiAndSpeak(baseUrl, spokenText, selectedPersona)
                                        reply = res.first
                                        debugLog = res.second
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
                                        val res = askMimiAndSpeak(baseUrl, "Flashlight on karo", selectedPersona)
                                        reply = res.first
                                        debugLog = res.second
                                        busy = false
                                    }
                                },
                                modifier = Modifier.weight(1f)
                            ) { Text("Torch ON") }

                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        busy = true
                                        val res = askMimiAndSpeak(baseUrl, "Brightness 40% kar do", selectedPersona)
                                        reply = res.first
                                        debugLog = res.second
                                        busy = false
                                    }
                                },
                                modifier = Modifier.weight(1f)
                            ) { Text("Bright 40%") }
                        }

                        if (showDebugPanel) {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(
                                    containerColor = if (blackMode) Color(0xFF141418) else Color(0xFFF5F2F0)
                                )
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    verticalArrangement = Arrangement.spacedBy(10.dp)
                                ) {
                                    Text(
                                        "Direct & GitHub Debug Console",
                                        style = MaterialTheme.typography.titleSmall
                                    )
                                    Text(
                                        "Mode: $selectedPersona · A11y: ${if (accessibilityEnabled) "Connected" else "Off"} · " +
                                            "Write: ${if (writeSettingsGranted) "Granted" else "Off"} · " +
                                            "DND: ${if (dndGranted) "Granted" else "Off"}",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                    Text(
                                        text = debugLog,
                                        style = MaterialTheme.typography.bodySmall,
                                        color = if (blackMode) Color(0xFFA1A1AA) else Color(0xFF57534E)
                                    )
                                    OutlinedTextField(
                                        value = baseUrl,
                                        onValueChange = { baseUrl = it },
                                        label = { Text("Backend API URL") },
                                        singleLine = true,
                                        modifier = Modifier.fillMaxWidth()
                                    )
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        OutlinedButton(
                                            onClick = {
                                                scope.launch {
                                                    debugLog = pingBackend(baseUrl)
                                                }
                                            },
                                            modifier = Modifier.weight(1f)
                                        ) { Text("Ping Server") }
                                        OutlinedButton(
                                            onClick = {
                                                val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                                cm.setPrimaryClip(
                                                    ClipData.newPlainText(
                                                        "MimiDebugLog",
                                                        "URL=$baseUrl\nMode=$selectedPersona\nA11y=$accessibilityEnabled\nWrite=$writeSettingsGranted\nDND=$dndGranted\nLog=$debugLog"
                                                    )
                                                )
                                                status = "Debug log copied"
                                            },
                                            modifier = Modifier.weight(1f)
                                        ) { Text("Copy Log") }
                                    }
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

    private suspend fun pingBackend(serverUrl: String): String = withContext(Dispatchers.IO) {
        val started = System.currentTimeMillis()
        val cleanBase = serverUrl.trim().removeSuffix("/")
        val req = Request.Builder().url(cleanBase).head().build()
        runCatching {
            client.newCall(req).execute().use { resp ->
                val ms = System.currentTimeMillis() - started
                "Server HTTP ${resp.code} in ${ms}ms"
            }
        }.getOrElse { err ->
            "Ping failed: ${err.message ?: "Unknown error"}"
        }
    }

    private suspend fun askMimiAndSpeak(
        serverUrl: String,
        command: String,
        persona: String
    ): Pair<String, String> = withContext(Dispatchers.IO) {
        val started = System.currentTimeMillis()
        val cleanBase = serverUrl.trim().removeSuffix("/")
        val jsonMedia = "application/json; charset=utf-8".toMediaType()
        val payload = JSONObject()
            .put("message", command)
            .put("persona", persona)
            .toString()
        val req = Request.Builder()
            .url("$cleanBase/api/assistant")
            .post(payload.toRequestBody(jsonMedia))
            .build()

        var statusCode = 0
        val respBody = runCatching {
            client.newCall(req).execute().use {
                statusCode = it.code
                it.body?.string()
            }
        }.getOrNull() ?: return@withContext Pair(
            "Server se connect nahi ho paya. URL check karo.",
            "POST /api/assistant -> Network failure"
        )

        val json = runCatching { JSONObject(respBody) }.getOrNull()
            ?: return@withContext Pair(
                "Invalid response from server.",
                "HTTP $statusCode -> Non-JSON body"
            )

        if (json.has("error")) {
            val errMsg = json.optString("error", "Server error")
            return@withContext Pair(errMsg, "HTTP $statusCode -> $errMsg")
        }

        val replyText = json.optString("replyText", "Done!")
        val actionCount = json.optJSONArray("actions")?.length() ?: 0

        withContext(Dispatchers.Main) {
            controller.applyAssistantResponse(json)
        }

        val ttsPayload = JSONObject()
            .put("text", replyText)
            .put("persona", persona)
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
        val elapsed = System.currentTimeMillis() - started
        Pair(replyText, "HTTP $statusCode · mode=$persona · ${actionCount} action(s) · ${elapsed}ms")
    }

    override fun onDestroy() {
        super.onDestroy()
        speechRecognizer?.destroy()
        mediaPlayer?.release()
    }
}
