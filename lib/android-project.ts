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
      description: 'Jetpack Compose UI with Black Mode, All-in-One Girl Voice Modes (Jaan/Friendly/Flirty), ON_RESUME permission refresh, and Direct & GitHub Debug console.',
      content: `package com.mimiai.assistant

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

    private val defaultBaseUrl = "${cleanUrl}"
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
                                FilterChip(
                                    selected = selectedPersona == id,
                                    onClick = {
                                        selectedPersona = id
                                        reply = when (id) {
                                            "jaan" -> "Hii meri Jaan! Main hamesha aapke saath hoon. Bolo kya karoon?"
                                            "friendly" -> "Heyy bestie! Chill karo, bolo phone mein kya set karna hai?"
                                            "flirty" -> "Hii handsome! Aaj bade pyaar se yaad kiya? Bolo kya command hai!"
                                            "bubbly" -> "Hii! Main Mimi hoon — bolo aaj kya karna hai?"
                                            "calm" -> "Hello... aaram se bolo, main pyaar se kar doongi."
                                            else -> "Hii Jaan! All-in-One mode ready hai — Friendly, Flirty ya Phone Control, bolo!"
                                        }
                                    },
                                    label = { Text(label) }
                                )
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
                                        status = "You: \$cmd"
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
                                    status = "You: \$spokenText"
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
                                        "Mode: \$selectedPersona · A11y: \${if (accessibilityEnabled) "Connected" else "Off"} · " +
                                            "Write: \${if (writeSettingsGranted) "Granted" else "Off"} · " +
                                            "DND: \${if (dndGranted) "Granted" else "Off"}",
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
                                                        "URL=\$baseUrl\\nMode=\$selectedPersona\\nA11y=\$accessibilityEnabled\\nWrite=\$writeSettingsGranted\\nDND=\$dndGranted\\nLog=\$debugLog"
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
                "Server HTTP \${resp.code} in \${ms}ms"
            }
        }.getOrElse { err ->
            "Ping failed: \${err.message ?: "Unknown error"}"
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
            "Server se connect nahi ho paya. URL check karo.",
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
        Pair(replyText, "HTTP \$statusCode · mode=\$persona · \${actionCount} action(s) · \${elapsed}ms")
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
      description: 'Executes Flashlight, Brightness, Volume, DND, Alarms, Calls, App Launches, and Accessibility gestures.',
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
import android.provider.AlarmClock
import android.provider.Settings
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

class PhoneController(private val context: Context) {

    fun setFlashlight(enabled: Boolean) {
        runCatching {
            val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val cameraId = cameraManager.cameraIdList.firstOrNull { id ->
                cameraManager.getCameraCharacteristics(id)
                    .get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
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
            Settings.System.putInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL)
            Settings.System.putInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, value)
        }
    }

    fun setDnd(enabled: Boolean) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (!nm.isNotificationPolicyAccessGranted) return
        runCatching {
            nm.setInterruptionFilter(if (enabled) NotificationManager.INTERRUPTION_FILTER_PRIORITY else NotificationManager.INTERRUPTION_FILTER_ALL)
        }
    }

    fun openWriteSettings() {
        runCatching {
            context.startActivity(Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:\${context.packageName}")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    fun openDndSettings() {
        runCatching {
            context.startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    fun openUri(uriString: String) {
        if (uriString.isBlank()) return
        runCatching {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(uriString)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }

    fun openApp(appName: String, launchUri: String? = null) {
        val packageMap = mapOf(
            "youtube" to "com.google.android.youtube",
            "whatsapp" to "com.whatsapp",
            "instagram" to "com.instagram.android",
            "spotify" to "com.spotify.music",
            "maps" to "com.google.android.apps.maps",
            "chrome" to "com.android.chrome"
        )
        val pkg = packageMap[appName.lowercase().trim()]
        val launch = pkg?.let { context.packageManager.getLaunchIntentForPackage(it) }
        if (launch != null) {
            context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } else if (!launchUri.isNullOrBlank()) {
            openUri(launchUri)
        }
    }

    fun dialCall(phoneOrUri: String) {
        val uriString = if (phoneOrUri.startsWith("tel:")) phoneOrUri else "tel:\$phoneOrUri"
        val hasPerm = ContextCompat.checkSelfPermission(context, Manifest.permission.CALL_PHONE) == PackageManager.PERMISSION_GRANTED
        val action = if (hasPerm) Intent.ACTION_CALL else Intent.ACTION_DIAL
        runCatching {
            context.startActivity(Intent(action, Uri.parse(uriString)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
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

    fun applyAssistantResponse(responseJson: JSONObject) {
        val stateJson = responseJson.optJSONObject("updatedPhoneState")
        val actions = responseJson.optJSONArray("actions") ?: JSONArray()
        for (i in 0 until actions.length()) {
            val act = actions.optJSONObject(i) ?: continue
            val tool = act.optString("tool")
            val summary = act.optString("summary")
            val launchUri = act.optString("launchUri")
            when (tool) {
                "toggleSystemSetting" -> if (stateJson != null) {
                    setFlashlight(stateJson.optBoolean("flashlight", false))
                    setDnd(stateJson.optBoolean("dnd", false))
                }
                "adjustLevel" -> if (stateJson != null) {
                    if (summary.contains("Brightness", ignoreCase = true)) setBrightnessPercent(stateJson.optInt("brightness", 68))
                    else if (summary.contains("Volume", ignoreCase = true)) setVolumePercent(stateJson.optInt("volume", 60))
                }
                "openApp" -> openApp(stateJson?.optString("activeApp", "") ?: "", launchUri)
                "makeCall" -> if (launchUri.isNotBlank()) dialCall(launchUri)
                "sendMessage" -> if (launchUri.isNotBlank()) openUri(launchUri)
                "setAlarmOrTimer" -> {
                    val latest = stateJson?.optJSONArray("alarms")?.optJSONObject(0)
                    if (latest != null) {
                        val parts = latest.optString("time", "07:00").split(":")
                        setAlarm(parts.getOrNull(0)?.toIntOrNull() ?: 7, parts.getOrNull(1)?.toIntOrNull() ?: 0, latest.optString("label", "Mimi"))
                    }
                }
                "performScreenGesture" -> {
                    val gestureRaw = summary.removePrefix("Gesture: ").trim().replace(" ", "_")
                    MimiAccessibilityService.instance?.executeNavigationGesture(gestureRaw)
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
      description: 'OS-level Accessibility service for Home/Back/Recents, scrolling, and screen clicks.',
      content: `package com.mimiai.assistant

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Build
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

class MimiAccessibilityService : AccessibilityService() {
    companion object {
        var instance: MimiAccessibilityService? = null
            private set
    }
    override fun onServiceConnected() { super.onServiceConnected(); instance = this }
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
    override fun onInterrupt() {}
    override fun onDestroy() { super.onDestroy(); if (instance === this) instance = null }

    fun executeNavigationGesture(gesture: String, targetText: String? = null): Boolean {
        return when (gesture.lowercase().trim()) {
            "home" -> performGlobalAction(GLOBAL_ACTION_HOME)
            "back" -> performGlobalAction(GLOBAL_ACTION_BACK)
            "recents" -> performGlobalAction(GLOBAL_ACTION_RECENTS)
            "notifications" -> performGlobalAction(GLOBAL_ACTION_NOTIFICATIONS)
            "lock_screen" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN) else false
            "screenshot" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT) else false
            "scroll_down" -> performSwipe(540f, 1500f, 540f, 500f)
            "scroll_up" -> performSwipe(540f, 500f, 540f, 1500f)
            "tap_text" -> if (!targetText.isNullOrBlank()) tapNodeByText(targetText) else false
            else -> false
        }
    }

    private fun performSwipe(x1: Float, y1: Float, x2: Float, y2: Float): Boolean {
        val path = Path().apply { moveTo(x1, y1); lineTo(x2, y2) }
        val stroke = GestureDescription.StrokeDescription(path, 0L, 260L)
        return dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(), null, null)
    }

    private fun tapNodeByText(query: String): Boolean {
        val root = rootInActiveWindow ?: return false
        for (node in root.findAccessibilityNodeInfosByText(query)) {
            var current: AccessibilityNodeInfo? = node
            while (current != null) {
                if (current.isClickable) return current.performAction(AccessibilityNodeInfo.ACTION_CLICK)
                current = current.parent
            }
        }
        return false
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
      description: 'Android 11+ <queries>, permissions, and AccessibilityService declaration.',
      content: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.CALL_PHONE" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.ACCESS_NOTIFICATION_POLICY" />
    <uses-permission android:name="android.permission.WRITE_SETTINGS" />
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
            <action android:name="android.intent.action.DIAL" />
        </intent>
        <intent>
            <action android:name="android.intent.action.CALL" />
        </intent>
        <intent>
            <action android:name="android.intent.action.SET_ALARM" />
        </intent>
        <package android:name="com.google.android.youtube" />
        <package android:name="com.whatsapp" />
        <package android:name="com.instagram.android" />
        <package android:name="com.spotify.music" />
        <package android:name="com.google.android.apps.maps" />
        <package android:name="com.android.chrome" />
    </queries>

    <application
        android:allowBackup="true"
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
      description: 'String resources required by AndroidManifest and Accessibility config.',
      content: `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">Mimi AI</string>
    <string name="mimi_accessibility_desc">Allows Mimi AI to perform voice-controlled navigation, screen gestures, and app actions across your phone.</string>
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
      description: 'GitHub Actions workflow: builds Debug APK, runs lintDebug, verifies APK zip integrity, and uploads APK + Debug Reports.',
      content: `name: Build Android Debug APK

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

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

      - name: Set up Android SDK
        uses: android-actions/setup-android@v3

      - name: Install Android 35 SDK & Build Tools
        run: |
          yes | sdkmanager --licenses > /dev/null || true
          sdkmanager "platforms;android-35" "build-tools;35.0.0"

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

      - name: Verify Debug APK Integrity
        run: |
          APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
          test -f "$APK_PATH"
          unzip -tq "$APK_PATH"
          APK_SIZE=$(ls -lh "$APK_PATH" | awk '{print $5}')
          {
            echo "## Mimi AI Debug APK Build Verified"
            echo "- **Artifact:** \`mimi-ai-debug-apk\`"
            echo "- **Package:** \`com.mimiai.assistant\`"
            echo "- **APK Size:** \`$APK_SIZE\`"
            echo "- **Install:** Download \`mimi-ai-debug-apk\` from Artifacts above, unzip, and install \`app-debug.apk\` on Android."
          } >> "$GITHUB_STEP_SUMMARY"

      - name: Upload Debug APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: mimi-ai-debug-apk
          path: android/app/build/outputs/apk/debug/app-debug.apk
          if-no-files-found: error
          retention-days: 30

      - name: Upload GitHub Debug Lint & Build Reports
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: mimi-ai-debug-reports
          path: |
            android/app/build/reports/
            android/build/reports/
          if-no-files-found: ignore
          retention-days: 14
`,
    },
    {
      path: 'README.md',
      language: 'markdown',
      description: 'Instructions for Direct ADB Debugging, Black Mode, and GitHub Actions APK install.',
      content: `# Mimi AI — Android App Setup

## Option 1: Install from GitHub Actions
1. Push this folder to a GitHub repository.
2. Open the **Actions** tab on GitHub and click **Build Android Debug APK**.
3. Download **mimi-ai-debug-apk** (APK) or **mimi-ai-debug-reports** (Lint/Debug logs) and install \`app-debug.apk\` on your Android phone.

## Option 2: Direct Debugging (USB / Wireless ADB)
1. Enable **Developer Options -> USB Debugging** on your Android phone.
2. Run inside \`android/\`:
   \`\`\`bash
   gradle assembleDebug
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   \`\`\`
3. Pointing to live Mimi server: **${cleanUrl}**
`,
    },
  ];
}
