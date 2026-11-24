export interface AndroidProjectFile {
  path: string;
  language: 'kotlin' | 'xml' | 'gradle' | 'markdown' | 'yaml' | 'text';
  description: string;
  content: string;
}

export function buildAndroidProjectFiles(backendBaseUrl: string): AndroidProjectFile[] {
  const cleanUrl = backendBaseUrl.replace(/\/+$/, '');

  return [
    {
      path: 'android/app/src/main/java/com/mimiai/assistant/MainActivity.kt',
      language: 'kotlin',
      description:
        'Jetpack Compose UI for Jassi AI with animated portrait & 7-bar talking equalizer, custom Call-Me name (default Kunal, no Boss), 6 voice modes, Hands-Free loop, Black Mode, and A-to-Z permission dashboard.',
      content: `package com.mimiai.assistant

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

    private val defaultBaseUrl = "${cleanUrl}"
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
            var status by remember { mutableStateOf("Tap \$aiName to speak · \$userName") }
            var reply by remember {
                mutableStateOf("Hii \$userName! Main \$aiName hoon — All-in-One mode mein. Bolo aaj kya karoon?")
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
                    status = "Sun rahi hoon \$userName..."
                    startVoiceInput { spokenText ->
                        listening = false
                        if (spokenText.isBlank()) {
                            status = "Tap \$aiName to speak"
                            return@startVoiceInput
                        }
                        status = "\$userName: \$spokenText"
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
                                        status = "Sun rahi hoon \$userName..."
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
                                    text = "\$aiName AI",
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
                                contentDescription = "\$aiName companion portrait",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize()
                            )
                        }

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
                                        "jaan" -> "Hii meri Jaan \$userName! Main hamesha aapke saath hoon. Bolo kya karoon?"
                                        "friendly" -> "Heyy \$userName! Chill karo bestie, bolo phone mein kya set karna hai?"
                                        "flirty" -> "Hii \$userName! Aaj bade pyaar se yaad kiya? Bolo kya command hai!"
                                        "smart_pro" -> "Ready hoon \$userName! Smart Pro active — apps, calls ya web, bolo!"
                                        "calm" -> "Hello \$userName... aaram se bolo, \$aiName pyaar se kar degi."
                                        else -> "Hii \$userName! All-in-One mode ready hai — Friendly, Flirty ya Phone Control, bolo!"
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
                                placeholder = { Text("Bolo \$aiName ko, \$userName...") },
                                singleLine = true,
                                modifier = Modifier.weight(1f)
                            )
                            Button(
                                onClick = {
                                    val cmd = commandInput.trim()
                                    if (cmd.isNotEmpty() && !busy) {
                                        commandInput = ""
                                        busy = true
                                        status = "\$userName: \$cmd"
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
                                        speaking -> "\$aiName Talking..."
                                        busy -> "Thinking..."
                                        else -> "Talk to \$aiName"
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
                                        "A11y: \${if (accessibilityEnabled) "ON" else "OFF"} · " +
                                            "Contacts: \${if (contactsGranted) "ON" else "OFF"} · " +
                                            "Write: \${if (writeSettingsGranted) "ON" else "OFF"} · " +
                                            "DND: \${if (dndGranted) "ON" else "OFF"} · " +
                                            "Overlay: \${if (overlayGranted) "ON" else "OFF"}",
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
                                                    "AI=\$aiName User=\$userName Mode=\$selectedPersona\\nA11y=\$accessibilityEnabled Contacts=\$contactsGranted Write=\$writeSettingsGranted DND=\$dndGranted Overlay=\$overlayGranted\\nLog=\$debugLog"
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
                "Server HTTP \${resp.code} in \${ms}ms"
            }
        }.getOrElse { err ->
            "Ping failed: \${err.message ?: "Unknown error"}"
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
            .url("\$cleanBase/api/assistant")
            .post(payload.toRequestBody(jsonMedia))
            .build()

        var statusCode = 0
        val respBody = runCatching {
            client.newCall(req).execute().use {
                statusCode = it.code
                it.body?.string()
            }
        }.getOrNull() ?: return@withContext Pair(
            "Server se connect nahi ho paya \$userName. URL check karo.",
            "POST /api/assistant -> Network failure"
        )

        val json = runCatching { JSONObject(respBody) }.getOrNull()
            ?: return@withContext Pair(
                "Invalid response from server.",
                "HTTP \$statusCode -> Non-JSON body"
            )

        if (json.has("error")) {
            val errMsg = json.optString("error", "Server error")
            return@withContext Pair(errMsg, "HTTP \$statusCode -> \$errMsg")
        }

        val replyText = json.optString("replyText", "Done \$userName!")
        val actionCount = json.optJSONArray("actions")?.length() ?: 0

        withContext(Dispatchers.Main) {
            controller.applyAssistantResponse(json)
        }

        val ttsPayload = JSONObject()
            .put("text", replyText)
            .put("persona", persona)
            .toString()
        val ttsReq = Request.Builder()
            .url("\$cleanBase/api/tts")
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
        Pair(replyText, "HTTP \$statusCode · \$aiName->\$userName · mode=\$persona · \${actionCount} action(s) · \${elapsed}ms")
    }

    override fun onDestroy() {
        super.onDestroy()
        speechRecognizer?.destroy()
        mediaPlayer?.release()
    }
}
`,
    },
    {
      path: 'android/app/src/main/java/com/mimiai/assistant/PhoneController.kt',
      language: 'kotlin',
      description:
        'A-to-Z Phone Controller: Contacts lookup, Calls, WhatsApp/SMS, Torch, Brightness, Volume, DND, Camera/Selfie/Video, Timers/Alarms, Media Keys, System Setting Panels, and Accessibility gestures.',
      content: `package com.mimiai.assistant

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.AlarmClock
import android.provider.ContactsContract
import android.provider.MediaStore
import android.provider.Settings
import android.view.KeyEvent
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

class PhoneController(private val context: Context) {

    fun setFlashlight(enabled: Boolean) {
        runCatching {
            val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraId = cameraManager.cameraIdList.firstOrNull { id ->
                val chars = cameraManager.getCameraCharacteristics(id)
                chars.get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
            } ?: cameraManager.cameraIdList.firstOrNull() ?: return
            cameraManager.setTorchMode(cameraId, enabled)
        }
    }

    fun setVolumePercent(percent: Int) {
        runCatching {
            val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val target = ((percent.coerceIn(0, 100) / 100f) * max).toInt()
            audio.setStreamVolume(AudioManager.STREAM_MUSIC, target, AudioManager.FLAG_SHOW_UI)
        }
    }

    fun setBrightnessPercent(percent: Int) {
        if (!Settings.System.canWrite(context)) {
            openWriteSettings()
            return
        }
        runCatching {
            val value = ((percent.coerceIn(5, 100) / 100f) * 255).toInt()
            Settings.System.putInt(
                context.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS_MODE,
                Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
            )
            Settings.System.putInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, value)
        }
    }

    fun setDnd(enabled: Boolean) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.isNotificationPolicyAccessGranted) {
            return
        }
        runCatching {
            nm.setInterruptionFilter(
                if (enabled) NotificationManager.INTERRUPTION_FILTER_PRIORITY
                else NotificationManager.INTERRUPTION_FILTER_ALL
            )
        }
    }

    fun openWriteSettings() {
        runCatching {
            val intent = Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS).apply {
                data = Uri.parse("package:\${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun openDndSettings() {
        runCatching {
            val intent = Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun openOverlaySettings() {
        runCatching {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                data = Uri.parse("package:\${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun openSystemSettingPanel(settingKey: String) {
        runCatching {
            val intent = when (settingKey.lowercase()) {
                "wifi", "mobiledata" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    Intent(Settings.Panel.ACTION_INTERNET_CONNECTIVITY)
                } else {
                    Intent(Settings.ACTION_WIFI_SETTINGS)
                }
                "bluetooth" -> Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                "location" -> Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)
                "hotspot" -> Intent(Settings.ACTION_WIRELESS_SETTINGS)
                "batterysaver" -> Intent(Settings.ACTION_BATTERY_SAVER_SETTINGS)
                "airplanemode" -> Intent(Settings.ACTION_AIRPLANE_MODE_SETTINGS)
                else -> Intent(Settings.ACTION_SETTINGS)
            }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    fun openUri(uriString: String) {
        if (uriString.isBlank()) return
        runCatching {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uriString)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun resolvePhoneNumber(contactOrNumber: String): String {
        val raw = contactOrNumber.removePrefix("tel:").trim()
        val digitsOnly = raw.replace(Regex("[^+\\\\d]"), "")
        if (digitsOnly.length >= 6 && raw.any { it.isDigit() }) {
            return digitsOnly
        }
        val hasContacts = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.READ_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED
        if (!hasContacts || raw.isBlank()) return raw

        return runCatching {
            val cursor = context.contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                arrayOf(
                    ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                    ContactsContract.CommonDataKinds.Phone.NUMBER
                ),
                "\${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?",
                arrayOf("%\$raw%"),
                null
            )
            cursor?.use { c ->
                if (c.moveToFirst()) {
                    val number = c.getString(1) ?: raw
                    return@runCatching number.replace(Regex("[^+\\\\d]"), "")
                }
            }
            raw
        }.getOrDefault(raw)
    }

    fun openApp(appName: String, launchUri: String? = null) {
        val packageMap = mapOf(
            "youtube" to "com.google.android.youtube",
            "whatsapp" to "com.whatsapp",
            "instagram" to "com.instagram.android",
            "spotify" to "com.spotify.music",
            "maps" to "com.google.android.apps.maps",
            "chrome" to "com.android.chrome",
            "gmail" to "com.google.android.gm",
            "telegram" to "org.telegram.messenger",
            "snapchat" to "com.snapchat.android",
            "calculator" to "com.google.android.calculator",
            "calendar" to "com.google.android.calendar",
            "clock" to "com.google.android.deskclock",
            "gallery" to "com.google.android.apps.photos",
            "photos" to "com.google.android.apps.photos",
            "playstore" to "com.android.vending",
            "play store" to "com.android.vending",
            "files" to "com.google.android.apps.nbu.files",
            "camera" to "com.android.camera2"
        )
        val normalized = appName.lowercase().trim()
        if (normalized == "settings") {
            openSystemSettingPanel("settings")
            return
        }
        if (normalized == "camera") {
            launchCamera("photo")
            return
        }
        val pkg = packageMap[normalized]
        if (pkg != null) {
            val launch = context.packageManager.getLaunchIntentForPackage(pkg)
            if (launch != null) {
                launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(launch)
                return
            }
        }
        if (!launchUri.isNullOrBlank()) {
            openUri(launchUri)
        }
    }

    fun launchCamera(mode: String) {
        runCatching {
            val action = if (mode.lowercase() == "video") {
                MediaStore.ACTION_VIDEO_CAPTURE
            } else {
                MediaStore.ACTION_IMAGE_CAPTURE
            }
            val intent = Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            if (mode.lowercase() == "selfie") {
                intent.putExtra("android.intent.extras.CAMERA_FACING", 1)
                intent.putExtra("android.intent.extra.USE_FRONT_CAMERA", true)
            }
            context.startActivity(intent)
        }
    }

    fun dialCall(phoneOrName: String) {
        val resolved = resolvePhoneNumber(phoneOrName)
        val uriString = if (resolved.startsWith("tel:")) resolved else "tel:\$resolved"
        val hasCallPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED
        val action = if (hasCallPermission) Intent.ACTION_CALL else Intent.ACTION_DIAL
        runCatching {
            val intent = Intent(action, Uri.parse(uriString)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
        }
    }

    fun setAlarm(hour: Int, minute: Int, label: String) {
        runCatching {
            val intent = Intent(AlarmClock.ACTION_SET_ALARM).apply {
                putExtra(AlarmClock.EXTRA_HOUR, hour.coerceIn(0, 23))
                putExtra(AlarmClock.EXTRA_MINUTES, minute.coerceIn(0, 59))
                putExtra(AlarmClock.EXTRA_MESSAGE, label)
                putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun setTimer(seconds: Int, label: String) {
        runCatching {
            val intent = Intent(AlarmClock.ACTION_SET_TIMER).apply {
                putExtra(AlarmClock.EXTRA_LENGTH, seconds.coerceAtLeast(1))
                putExtra(AlarmClock.EXTRA_MESSAGE, label)
                putExtra(AlarmClock.EXTRA_SKIP_UI, true)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun controlMediaPlayback(summary: String) {
        runCatching {
            val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val keyCode = when {
                summary.contains("Paused", ignoreCase = true) -> KeyEvent.KEYCODE_MEDIA_PAUSE
                summary.contains("Playing", ignoreCase = true) -> KeyEvent.KEYCODE_MEDIA_PLAY
                else -> KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE
            }
            audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_DOWN, keyCode))
            audio.dispatchMediaKeyEvent(KeyEvent(KeyEvent.ACTION_UP, keyCode))
        }
    }

    fun applyAssistantResponse(responseJson: JSONObject) {
        val stateJson = responseJson.optJSONObject("updatedPhoneState")
        val actions = responseJson.optJSONArray("actions") ?: JSONArray()

        for (i in 0 until actions.length()) {
            val act = actions.optJSONObject(i) ?: continue
            val tool = act.optString("tool")
            val summary = act.optString("summary")
            val launchUri = act.optString("launchUri")

            when (tool) {
                "toggleSystemSetting" -> {
                    if (stateJson != null) {
                        setFlashlight(stateJson.optBoolean("flashlight", false))
                        setDnd(stateJson.optBoolean("dnd", false))
                    }
                    listOf("wifi", "bluetooth", "mobileData", "hotspot", "location", "batterySaver", "airplaneMode")
                        .firstOrNull { summary.contains(it, ignoreCase = true) }
                        ?.let { openSystemSettingPanel(it) }
                }
                "adjustLevel" -> {
                    if (stateJson != null) {
                        if (summary.contains("Brightness", ignoreCase = true)) {
                            setBrightnessPercent(stateJson.optInt("brightness", 68))
                        } else if (summary.contains("Volume", ignoreCase = true)) {
                            setVolumePercent(stateJson.optInt("volume", 60))
                        }
                    }
                }
                "openApp" -> {
                    val appName = stateJson?.optString("activeApp", "") ?: ""
                    openApp(appName, launchUri)
                }
                "makeCall" -> {
                    val contact = stateJson?.optString("lastCall", "")?.takeIf { it.isNotBlank() } ?: launchUri
                    if (contact.isNotBlank()) dialCall(contact)
                }
                "sendMessage" -> {
                    val lastMsg = stateJson?.optJSONObject("lastMessage")
                    val recipient = lastMsg?.optString("recipient", "") ?: ""
                    val msgText = lastMsg?.optString("text", "") ?: ""
                    val resolvedNumber = if (recipient.isNotBlank()) resolvePhoneNumber(recipient) else ""
                    if (launchUri.startsWith("sms:") && resolvedNumber.any { it.isDigit() }) {
                        openUri("sms:\$resolvedNumber?body=\${Uri.encode(msgText)}")
                    } else if (launchUri.contains("wa.me") && resolvedNumber.any { it.isDigit() }) {
                        openUri("https://wa.me/\$resolvedNumber?text=\${Uri.encode(msgText)}")
                    } else if (launchUri.isNotBlank()) {
                        openUri(launchUri)
                    }
                }
                "setAlarmOrTimer" -> {
                    if (summary.startsWith("Timer set:", ignoreCase = true)) {
                        val secs = Regex("(\\\\d+)s").find(summary)?.groupValues?.getOrNull(1)?.toIntOrNull() ?: 60
                        setTimer(secs, "Jassi Timer")
                    } else {
                        val alarms = stateJson?.optJSONArray("alarms")
                        val latest = alarms?.optJSONObject(0)
                        if (latest != null) {
                            val timeParts = latest.optString("time", "07:00").split(":")
                            val hour = timeParts.getOrNull(0)?.toIntOrNull() ?: 7
                            val min = timeParts.getOrNull(1)?.toIntOrNull() ?: 0
                            setAlarm(hour, min, latest.optString("label", "Jassi Reminder"))
                        }
                    }
                }
                "controlMedia" -> controlMediaPlayback(summary)
                "searchWebOrMaps" -> if (launchUri.isNotBlank()) openUri(launchUri)
                "takePhotoOrVideo" -> {
                    val mode = when {
                        summary.contains("selfie", ignoreCase = true) -> "selfie"
                        summary.contains("video", ignoreCase = true) -> "video"
                        else -> "photo"
                    }
                    launchCamera(mode)
                }
                "performScreenGesture" -> {
                    val gestureRaw = summary.removePrefix("Gesture: ").trim().replace(" ", "_")
                    val tapMatch = Regex("^Tapped \\"(.+)\\"\$").find(summary)
                    val typeMatch = Regex("^Typed \\"(.+)\\"\$").find(summary)
                    when {
                        tapMatch != null -> MimiAccessibilityService.instance?.executeNavigationGesture(
                            "tap_text",
                            tapMatch.groupValues[1]
                        )
                        typeMatch != null -> MimiAccessibilityService.instance?.executeNavigationGesture(
                            "type_text",
                            typeMatch.groupValues[1]
                        )
                        else -> MimiAccessibilityService.instance?.executeNavigationGesture(gestureRaw)
                    }
                }
            }
        }
    }
}
`,
    },
    {
      path: 'android/app/src/main/java/com/mimiai/assistant/MimiAccessibilityService.kt',
      language: 'kotlin',
      description: 'OS-level A-to-Z Accessibility service for Home/Back/Recents, Quick Settings, Split Screen, Screenshots, Lock Screen, Swipes, Tap & Voice Typing.',
      content: `package com.mimiai.assistant

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.os.Bundle
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class MimiAccessibilityService : AccessibilityService() {

    companion object {
        var instance: MimiAccessibilityService? = null
            private set
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}

    override fun onInterrupt() {}

    override fun onDestroy() {
        super.onDestroy()
        if (instance === this) instance = null
    }

    fun executeNavigationGesture(gesture: String, targetText: String? = null): Boolean {
        return when (gesture.lowercase().trim()) {
            "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "recents" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
            "notifications" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
            "quick_settings" -> performGlobalAction(GLOBAL_ACTION_QUICK_SETTINGS)
            "power_dialog" -> performGlobalAction(GLOBAL_ACTION_POWER_DIALOG)
            "split_screen" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                performGlobalAction(GLOBAL_ACTION_TOGGLE_SPLIT_SCREEN)
            } else {
                false
            }
            "lock_screen" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN)
            } else {
                false
            }
            "screenshot" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)
            } else {
                false
            }
            "scroll_down" -> performSwipe(540f, 1500f, 540f, 500f)
            "scroll_up" -> performSwipe(540f, 500f, 540f, 1500f)
            "swipe_left" -> performSwipe(920f, 1000f, 160f, 1000f)
            "swipe_right" -> performSwipe(160f, 1000f, 920f, 1000f)
            "tap_text" -> if (!targetText.isNullOrBlank()) tapNodeByText(targetText) else false
            "type_text" -> if (!targetText.isNullOrBlank()) typeIntoFocusedField(targetText) else false
            else -> false
        }
    }

    private fun performSwipe(x1: Float, y1: Float, x2: Float, y2: Float): Boolean {
        val path = Path().apply {
            moveTo(x1, y1)
            lineTo(x2, y2)
        }
        val stroke = GestureDescription.StrokeDescription(path, 0L, 260L)
        return dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
    }

    private fun tapNodeByText(query: String): Boolean {
        val root = rootInActiveWindow ?: return false
        val matches = root.findAccessibilityNodeInfosByText(query)
        for (node in matches) {
            var current: AccessibilityNodeInfo? = node
            while (current != null) {
                if (current.isClickable) {
                    return current.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                }
                current = current.parent
            }
        }
        return false
    }

    private fun typeIntoFocusedField(text: String): Boolean {
        val focused = findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        }
        return focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    }
}
`,
    },
    {
      path: 'android/app/build.gradle.kts',
      language: 'gradle',
      description: 'AGP 8.7 + Kotlin 2.0 Compose Compiler + Lifecycle Compose + Debug Lint options.',
      content: `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.mimiai.assistant"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mimiai.assistant"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        debug {
            isDebuggable = true
        }
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation(platform("androidx.compose:compose-bom:2024.11.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("com.google.android.material:material:1.12.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
}
`,
    },
    {
      path: 'android/build.gradle.kts',
      language: 'gradle',
      description: 'Root Gradle plugin versions.',
      content: `plugins {
    id("com.android.application") version "8.7.3" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
    id("org.jetbrains.kotlin.plugin.compose") version "2.0.21" apply false
}
`,
    },
    {
      path: 'android/settings.gradle.kts',
      language: 'gradle',
      description: 'Gradle repositories and module include.',
      content: `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MimiAI"
include(":app")
`,
    },
    {
      path: 'android/gradle.properties',
      language: 'text',
      description: 'AndroidX and Gradle JVM settings.',
      content: `org.gradle.jvmargs=-Xmx1536m -XX:MaxMetaspaceSize=512m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
`,
    },
    {
      path: 'android/gradle/wrapper/gradle-wrapper.properties',
      language: 'text',
      description: 'Gradle 8.11.1 wrapper distribution.',
      content: `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.11.1-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`,
    },
    {
      path: 'android/app/src/main/AndroidManifest.xml',
      language: 'xml',
      description: 'Android 11+ <queries>, A-to-Z permissions (Contacts, SMS, Overlay, Wi-Fi, Bluetooth), custom launcher icons, and AccessibilityService.',
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.READ_CONTACTS" />
    <uses-permission android:name="android.permission.SEND_SMS" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" />
    <uses-permission android:name="android.permission.CHANGE_WIFI_STATE" />
    <uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
    <uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />
    <uses-permission android:name="android.permission.WRITE_SETTINGS" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="com.android.alarm.permission.SET_ALARM" />
    <uses-permission android:name="android.permission.QUERY_ALL_PACKAGES" />

    <queries>
        <intent>
            <action android:name="android.speech.RecognitionService" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="https" />
        </intent>
        <intent>
            <action android:name="android.intent.action.VIEW" />
            <data android:scheme="geo" />
        </intent>
        <intent>
            <action android:name="android.intent.action.DIAL" />
        </intent>
        <intent>
            <action android:name="android.intent.action.CALL" />
        </intent>
        <intent>
            <action android:name="android.intent.action.SENDTO" />
            <data android:scheme="smsto" />
        </intent>
        <intent>
            <action android:name="android.intent.action.SET_ALARM" />
        </intent>
        <intent>
            <action android:name="android.intent.action.SET_TIMER" />
        </intent>
        <intent>
            <action android:name="android.media.action.IMAGE_CAPTURE" />
        </intent>
        <package android:name="com.google.android.youtube" />
        <package android:name="com.whatsapp" />
        <package android:name="com.instagram.android" />
        <package android:name="com.spotify.music" />
        <package android:name="com.google.android.apps.maps" />
        <package android:name="com.android.chrome" />
        <package android:name="com.google.android.gm" />
        <package android:name="org.telegram.messenger" />
        <package android:name="com.snapchat.android" />
    </queries>

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.Material3.DayNight.NoActionBar">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTask">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.ASSIST" />
                <category android:name="android.intent.category.DEFAULT" />
            </intent-filter>
        </activity>

        <service
            android:name=".MimiAccessibilityService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/mimi_accessibility_config" />
        </service>
    </application>
</manifest>
`,
    },
    {
      path: 'android/app/src/debug/AndroidManifest.xml',
      language: 'xml',
      description: 'Debug-only manifest allowing local HTTP server testing.',
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:usesCleartextTraffic="true" />
</manifest>
`,
    },
    {
      path: 'android/app/src/main/res/values/strings.xml',
      language: 'xml',
      description: 'Jassi AI string resources required by AndroidManifest and Accessibility config.',
      content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Jassi AI</string>
    <string name="mimi_accessibility_desc">Allows Jassi AI to perform voice-controlled A-to-Z phone navigation, screen gestures, typing, screenshots, and app actions.</string>
</resources>
`,
    },
    {
      path: 'android/app/src/main/res/xml/mimi_accessibility_config.xml',
      language: 'xml',
      description: 'Accessibility gesture and window retrieval flags.',
      content: `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeAllMask"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault|flagRetrieveInteractiveWindows|flagReportViewIds"
    android:canPerformGestures="true"
    android:canRetrieveWindowContent="true"
    android:notificationTimeout="100"
    android:description="@string/mimi_accessibility_desc" />
`,
    },
    {
      path: '.github/workflows/android-debug-apk.yml',
      language: 'yaml',
      description: 'GitHub Actions workflow: builds Jassi AI Debug APK, runs lintDebug, verifies APK integrity, uploads Artifacts, and publishes to GitHub Releases.',
      content: `name: Build & Release Android Debug APK

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-debug-apk:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: Configure Android 35 SDK & Build Tools
        run: |
          SDK_DIR="\${ANDROID_HOME:-/usr/local/lib/android/sdk}"
          if [ ! -d "\$SDK_DIR" ]; then
            SDK_DIR="\$HOME/Android/Sdk"
            mkdir -p "\$SDK_DIR/cmdline-tools"
            curl -fsSL https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -o /tmp/cmdline-tools.zip
            unzip -q /tmp/cmdline-tools.zip -d /tmp/cmdline-unpack
            mv /tmp/cmdline-unpack/cmdline-tools "\$SDK_DIR/cmdline-tools/latest"
          fi
          echo "ANDROID_HOME=\$SDK_DIR" >> "\$GITHUB_ENV"
          echo "ANDROID_SDK_ROOT=\$SDK_DIR" >> "\$GITHUB_ENV"
          SDKMANAGER=\$(find "\$SDK_DIR/cmdline-tools" -name sdkmanager -type f 2>/dev/null | head -n 1)
          if [ -z "\$SDKMANAGER" ]; then
            echo "sdkmanager not found in \$SDK_DIR"
            exit 1
          fi
          echo "\$(dirname "\$SDKMANAGER")" >> "\$GITHUB_PATH"
          echo "\$SDK_DIR/platform-tools" >> "\$GITHUB_PATH"
          yes | "\$SDKMANAGER" --sdk_root="\$SDK_DIR" --licenses > /dev/null || true
          "\$SDKMANAGER" --sdk_root="\$SDK_DIR" "platform-tools" "platforms;android-35" "build-tools;35.0.0"

      - name: Setup Gradle
        uses: gradle/actions/setup-gradle@v4
        with:
          gradle-version: 8.11.1

      - name: Build Debug APK
        working-directory: android
        run: gradle assembleDebug --no-daemon --stacktrace

      - name: Run Android Debug Lint
        working-directory: android
        run: gradle lintDebug --no-daemon

      - name: Verify & Package Debug APK
        run: |
          APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
          RELEASE_APK="android/app/build/outputs/apk/debug/jassi-ai-debug.apk"
          test -f "\$APK_PATH"
          unzip -tq "\$APK_PATH"
          cp "\$APK_PATH" "\$RELEASE_APK"
          APK_SIZE=\$(ls -lh "\$RELEASE_APK" | awk '{print \$5}')
          {
            echo "## Jassi AI Debug APK Build & Release Verified"
            echo "- **Package:** \\\`com.mimiai.assistant\\\`"
            echo "- **APK Size:** \\\`\$APK_SIZE\\\`"
            echo "- **Release File:** \\\`jassi-ai-debug.apk\\\` (published to GitHub Releases & Actions Artifacts)"
          } >> "\$GITHUB_STEP_SUMMARY"

      - name: Upload Debug APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: jassi-ai-debug-apk
          path: android/app/build/outputs/apk/debug/jassi-ai-debug.apk
          if-no-files-found: error
          retention-days: 30

      - name: Upload GitHub Debug Lint & Build Reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: jassi-ai-debug-reports
          path: |
            android/app/build/reports/
            android/build/reports/
          if-no-files-found: ignore
          retention-days: 14

      - name: Publish APK to GitHub Releases
        if: github.event_name == 'push' || github.event_name == 'workflow_dispatch'
        uses: softprops/action-gh-release@v2
        with:
          tag_name: v1.0.\${{ github.run_number }}
          name: Jassi AI v1.0.\${{ github.run_number }} (Debug APK)
          body: |
            Automatic Android Debug APK build for **Jassi AI** (Glamorous Avatar & App Logo + Animated Talking Orb + Custom Name Calling + A-to-Z Phone Control + Black Mode).
            Download **jassi-ai-debug.apk** below and install it on your Android phone.
          files: android/app/build/outputs/apk/debug/jassi-ai-debug.apk
          make_latest: true
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`,
    },
    {
      path: 'README.md',
      language: 'markdown',
      description: 'Instructions for Direct ADB Debugging, Jassi AI A-to-Z Permissions, and GitHub Releases APK install.',
      content: `# Jassi AI — Android App Setup

## Option 1: Install from GitHub Releases
1. Push this repository to GitHub.
2. Open **Releases** (or **Actions -> Build & Release Android Debug APK**).
3. Download **jassi-ai-debug.apk** and install it on your Android phone.

## Option 2: Direct Debugging (USB / Wireless ADB)
1. Enable **Developer Options -> USB Debugging** on your Android phone.
2. Run inside \`android/\`:
   \`\`\`bash
   gradle assembleDebug
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   \`\`\`
3. Pointing to live Jassi AI server: **${cleanUrl}**
`,
    },
  ];
}
