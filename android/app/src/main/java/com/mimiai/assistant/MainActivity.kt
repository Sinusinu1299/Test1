package com.mimiai.assistant

import android.Manifest
import android.app.NotificationManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
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
import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
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
        "smart_pro" to "Smart Pro",
        "calm" to "Soft"
    )

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { }

    private fun requestAllRuntimePermissions() {
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.CALL_PHONE,
                Manifest.permission.READ_CONTACTS,
                Manifest.permission.SEND_SMS,
                Manifest.permission.CAMERA
            )
        )
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        controller = PhoneController(this)
        val prefs = getSharedPreferences("jassi_prefs", Context.MODE_PRIVATE)
        requestAllRuntimePermissions()

        setContent {
            val scope = rememberCoroutineScope()
            val lifecycleOwner = LocalLifecycleOwner.current

            var baseUrl by remember { mutableStateOf(defaultBaseUrl) }
            var userName by remember { mutableStateOf(prefs.getString("user_name", "Kunal") ?: "Kunal") }
            var aiName by remember { mutableStateOf(prefs.getString("ai_name", "Jassi") ?: "Jassi") }
            var commandInput by remember { mutableStateOf("") }
            var selectedPersona by remember { mutableStateOf("all_in_one") }
            var status by remember { mutableStateOf("Tap $aiName to speak · $userName") }
            var reply by remember {
                mutableStateOf("Hii $userName! Main $aiName hoon — All-in-One mode mein. Bolo aaj kya karoon?")
            }
            var debugLog by remember { mutableStateOf("Ready for A-to-Z Phone Control & Debug") }
            var listening by remember { mutableStateOf(false) }
            var speaking by remember { mutableStateOf(false) }
            var busy by remember { mutableStateOf(false) }
            var handsFree by remember { mutableStateOf(false) }
            var showDebugPanel by remember { mutableStateOf(true) }
            var showCustomPanel by remember { mutableStateOf(false) }
            var blackMode by remember { mutableStateOf(true) }

            var accessibilityEnabled by remember { mutableStateOf(MimiAccessibilityService.instance != null) }
            var writeSettingsGranted by remember { mutableStateOf(Settings.System.canWrite(this@MainActivity)) }
            var overlayGranted by remember { mutableStateOf(Settings.canDrawOverlays(this@MainActivity)) }
            var contactsGranted by remember {
                mutableStateOf(
                    ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
                )
            }
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
                        overlayGranted = Settings.canDrawOverlays(this@MainActivity)
                        contactsGranted = ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.READ_CONTACTS
                        ) == PackageManager.PERMISSION_GRANTED
                        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                        dndGranted = nm.isNotificationPolicyAccessGranted
                    }
                }
                lifecycleOwner.lifecycle.addObserver(observer)
                onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
            }

            val triggerVoiceLoop: () -> Unit = {
                if (!listening && !busy) {
                    listening = true
                    status = "Sun rahi hoon $userName..."
                    startVoiceInput { spokenText ->
                        listening = false
                        if (spokenText.isBlank()) {
                            status = "Tap $aiName to speak"
                            return@startVoiceInput
                        }
                        status = "$userName: $spokenText"
                        busy = true
                        scope.launch {
                            val res = askJassiAndSpeak(
                                serverUrl = baseUrl,
                                command = spokenText,
                                persona = selectedPersona,
                                aiName = aiName.ifBlank { "Jassi" },
                                userName = userName.ifBlank { "Kunal" },
                                onSpeakingChange = { active ->
                                    speaking = active
                                    if (!active && handsFree) {
                                        listening = true
                                        status = "Sun rahi hoon $userName..."
                                    }
                                }
                            )
                            reply = res.first
                            debugLog = res.second
                            status = "Ready"
                            busy = false
                        }
                    }
                }
            }

            val infiniteTransition = rememberInfiniteTransition(label = "jassi_orb")
            val pulseScale by infiniteTransition.animateFloat(
                initialValue = 1f,
                targetValue = if (speaking) 1.08f else if (listening) 1.05f else 1.02f,
                animationSpec = infiniteRepeatable(
                    animation = tween(if (speaking) 480 else 1400, easing = FastOutSlowInEasing),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "orb_scale"
            )
            val barPulse by infiniteTransition.animateFloat(
                initialValue = 0.25f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(if (speaking) 360 else 800, easing = LinearEasing),
                    repeatMode = RepeatMode.Reverse
                ),
                label = "wave_bar"
            )

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
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "$aiName AI",
                                    style = MaterialTheme.typography.headlineSmall
                                )
                                Text(
                                    text = status,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = if (blackMode) Color(0xFFA1A1AA) else Color(0xFF57534E)
                                )
                            }
                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                TextButton(onClick = { showCustomPanel = !showCustomPanel }) {
                                    Text(userName)
                                }
                                TextButton(onClick = { blackMode = !blackMode }) {
                                    Text(if (blackMode) "Light" else "Black")
                                }
                                TextButton(onClick = { showDebugPanel = !showDebugPanel }) {
                                    Text(if (showDebugPanel) "Hide" else "A-Z")
                                }
                            }
                        }

                        if (showCustomPanel) {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(
                                    containerColor = if (blackMode) Color(0xFF141418) else Color(0xFFF5F2F0)
                                )
                            ) {
                                Column(
                                    modifier = Modifier.padding(14.dp),
                                    verticalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    Text("Custom Name Calling (No Boss)", style = MaterialTheme.typography.titleSmall)
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        OutlinedTextField(
                                            value = userName,
                                            onValueChange = {
                                                userName = it
                                                prefs.edit().putString("user_name", it.ifBlank { "Kunal" }).apply()
                                            },
                                            label = { Text("Call Me") },
                                            singleLine = true,
                                            modifier = Modifier.weight(1f)
                                        )
                                        OutlinedTextField(
                                            value = aiName,
                                            onValueChange = {
                                                aiName = it
                                                prefs.edit().putString("ai_name", it.ifBlank { "Jassi" }).apply()
                                            },
                                            label = { Text("AI Name") },
                                            singleLine = true,
                                            modifier = Modifier.weight(1f)
                                        )
                                    }
                                }
                            }
                        }

                        // Glamorous Animated Jassi Portrait + Talking Waveform
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .padding(vertical = 4.dp)
                                .size(164.dp)
                                .scale(pulseScale)
                                .clip(CircleShape)
                                .border(
                                    width = if (speaking || listening) 3.dp else 2.dp,
                                    color = if (speaking || listening) Color(0xFFF43F5E) else Color(0xFF3F3F46),
                                    shape = CircleShape
                                )
                                .clickable {
                                    if (listening) {
                                        speechRecognizer?.stopListening()
                                        listening = false
                                    } else {
                                        triggerVoiceLoop()
                                    }
                                }
                        ) {
                            Image(
                                painter = painterResource(id = R.drawable.jassi_avatar),
                                contentDescription = "$aiName companion portrait",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }

                        // Talking / Listening Animated Equalizer Bars
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.height(28.dp)
                        ) {
                            val heights = listOf(10f, 22f, 16f, 26f, 18f, 22f, 12f)
                            heights.forEachIndexed { idx, base ->
                                val barH = if (speaking) {
                                    val phase = ((barPulse + idx * 0.17f) % 1f)
                                    6.dp + ((base * phase).dp)
                                } else if (listening) {
                                    6.dp + ((base * 0.5f * barPulse).dp)
                                } else {
                                    5.dp
                                }
                                Box(
                                    modifier = Modifier
                                        .width(4.dp)
                                        .height(barH)
                                        .clip(RoundedCornerShape(4.dp))
                                        .background(
                                            if (speaking || listening) Color(0xFFF43F5E)
                                            else Color(0xFF52525B)
                                        )
                                )
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
                                        "jaan" -> "Hii meri Jaan $userName! Main hamesha aapke saath hoon. Bolo kya karoon?"
                                        "friendly" -> "Heyy $userName! Chill karo bestie, bolo phone mein kya set karna hai?"
                                        "flirty" -> "Hii $userName! Aaj bade pyaar se yaad kiya? Bolo kya command hai!"
                                        "smart_pro" -> "Ready hoon $userName! Smart Pro active — apps, calls ya web, bolo!"
                                        "calm" -> "Hello $userName... aaram se bolo, $aiName pyaar se kar degi."
                                        else -> "Hii $userName! All-in-One mode ready hai — Friendly, Flirty ya Phone Control, bolo!"
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
                                placeholder = { Text("Bolo $aiName ko, $userName...") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            Button(
                                onClick = {
                                    val cmd = commandInput.trim()
                                    if (cmd.isNotEmpty() && !busy) {
                                        commandInput = ""
                                        busy = true
                                        status = "$userName: $cmd"
                                        scope.launch {
                                            val res = askJassiAndSpeak(
                                                serverUrl = baseUrl,
                                                command = cmd,
                                                persona = selectedPersona,
                                                aiName = aiName.ifBlank { "Jassi" },
                                                userName = userName.ifBlank { "Kunal" },
                                                onSpeakingChange = { active -> speaking = active }
                                            )
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

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = {
                                    if (listening) {
                                        speechRecognizer?.stopListening()
                                        listening = false
                                    } else {
                                        triggerVoiceLoop()
                                    }
                                },
                                modifier = Modifier.weight(1f).height(52.dp)
                            ) {
                                Text(
                                    when {
                                        listening -> "Listening..."
                                        speaking -> "$aiName Talking..."
                                        busy -> "Thinking..."
                                        else -> "Talk to $aiName"
                                    }
                                )
                            }
                            OutlinedButton(
                                onClick = { handsFree = !handsFree },
                                modifier = Modifier.height(52.dp)
                            ) {
                                Text(if (handsFree) "Loop ON" else "Loop OFF")
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            OutlinedButton(
                                onClick = {
                                    scope.launch {
                                        busy = true
                                        val res = askJassiAndSpeak(
                                            baseUrl, "Flashlight on karo", selectedPersona, aiName, userName
                                        ) { speaking = it }
                                        reply = res.first
                                        debugLog = res.second
                                        busy = false
                                    }
                                },
                                modifier = Modifier.weight(1f)
                            ) { Text("Torch") }

                            OutlinedButton(
                                onClick = { controller.launchCamera("selfie") },
                                modifier = Modifier.weight(1f)
                            ) { Text("Selfie") }

                            OutlinedButton(
                                onClick = {
                                    MimiAccessibilityService.instance?.executeNavigationGesture("screenshot")
                                },
                                modifier = Modifier.weight(1f)
                            ) { Text("Shot") }
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
                                        "A-to-Z Phone Access & Debug Console",
                                        style = MaterialTheme.typography.titleSmall
                                    )
                                    Text(
                                        "A11y: ${if (accessibilityEnabled) "ON" else "OFF"} · " +
                                            "Contacts: ${if (contactsGranted) "ON" else "OFF"} · " +
                                            "Write: ${if (writeSettingsGranted) "ON" else "OFF"} · " +
                                            "DND: ${if (dndGranted) "ON" else "OFF"} · " +
                                            "Overlay: ${if (overlayGranted) "ON" else "OFF"}",
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
                                                scope.launch { debugLog = pingBackend(baseUrl) }
                                            },
                                            modifier = Modifier.weight(1f)
                                        ) { Text("Ping Server") }
                                        OutlinedButton(
                                            onClick = { requestAllRuntimePermissions() },
                                            modifier = Modifier.weight(1f)
                                        ) { Text("Grant Basic") }
                                    }
                                    OutlinedButton(
                                        onClick = {
                                            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text("1. Enable A-to-Z Accessibility Service")
                                    }
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                                    ) {
                                        OutlinedButton(
                                            onClick = { controller.openWriteSettings() },
                                            modifier = Modifier.weight(1f)
                                        ) { Text("2. Brightness") }
                                        OutlinedButton(
                                            onClick = { controller.openDndSettings() },
                                            modifier = Modifier.weight(1f)
                                        ) { Text("3. Silent/DND") }
                                        OutlinedButton(
                                            onClick = { controller.openOverlaySettings() },
                                            modifier = Modifier.weight(1f)
                                        ) { Text("4. Overlay") }
                                    }
                                    OutlinedButton(
                                        onClick = {
                                            val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                            cm.setPrimaryClip(
                                                ClipData.newPlainText(
                                                    "JassiDebugLog",
                                                    "AI=$aiName User=$userName Mode=$selectedPersona\nA11y=$accessibilityEnabled Contacts=$contactsGranted Write=$writeSettingsGranted DND=$dndGranted Overlay=$overlayGranted\nLog=$debugLog"
                                                )
                                            )
                                            status = "Debug log copied"
                                        },
                                        modifier = Modifier.fillMaxWidth()
                                    ) { Text("Copy Full A-to-Z Debug Log") }
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

    private suspend fun askJassiAndSpeak(
        serverUrl: String,
        command: String,
        persona: String,
        aiName: String,
        userName: String,
        onSpeakingChange: (Boolean) -> Unit
    ): Pair<String, String> = withContext(Dispatchers.IO) {
        val started = System.currentTimeMillis()
        val cleanBase = serverUrl.trim().removeSuffix("/")
        val jsonMedia = "application/json; charset=utf-8".toMediaType()
        val payload = JSONObject()
            .put("message", command)
            .put("persona", persona)
            .put("aiName", aiName)
            .put("userName", userName)
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
            "Server se connect nahi ho paya $userName. URL check karo.",
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

        val replyText = json.optString("replyText", "Done $userName!")
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
                val tempWav = File(cacheDir, "jassi_reply.wav")
                tempWav.writeBytes(wavBytes)
                withContext(Dispatchers.Main) {
                    onSpeakingChange(true)
                    mediaPlayer?.release()
                    mediaPlayer = MediaPlayer().apply {
                        setDataSource(tempWav.absolutePath)
                        setOnCompletionListener { onSpeakingChange(false) }
                        setOnErrorListener { _, _, _ -> onSpeakingChange(false); true }
                        prepare()
                        start()
                    }
                }
            }
        }
        val elapsed = System.currentTimeMillis() - started
        Pair(replyText, "HTTP $statusCode · $aiName->$userName · mode=$persona · ${actionCount} action(s) · ${elapsed}ms")
    }

    override fun onDestroy() {
        super.onDestroy()
        speechRecognizer?.destroy()
        mediaPlayer?.release()
    }
}
