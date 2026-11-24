package com.mimiai.assistant

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
                data = Uri.parse("package:${context.packageName}")
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

    fun openUri(uriString: String) {
        if (uriString.isBlank()) return
        runCatching {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uriString)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
    }

    fun openApp(appName: String, launchUri: String? = null) {
        val packageMap = mapOf(
            "youtube" to "com.google.android.youtube",
            "whatsapp" to "com.whatsapp",
            "instagram" to "com.instagram.android",
            "spotify" to "com.spotify.music",
            "maps" to "com.google.android.apps.maps",
            "chrome" to "com.android.chrome",
            "camera" to "com.android.camera2"
        )
        val normalized = appName.lowercase().trim()
        if (normalized == "settings") {
            runCatching {
                context.startActivity(
                    Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            }
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

    fun dialCall(phoneOrUri: String) {
        val uriString = if (phoneOrUri.startsWith("tel:")) phoneOrUri else "tel:$phoneOrUri"
        val hasCallPermission = ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED
        val action = if (hasCallPermission) Intent.ACTION_CALL else Intent.ACTION_DIAL
        runCatching {
            val intent = Intent(action, Uri.parse(uriString)).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
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
                    if (launchUri.isNotBlank()) dialCall(launchUri)
                }
                "sendMessage" -> {
                    if (launchUri.isNotBlank()) openUri(launchUri)
                }
                "setAlarmOrTimer" -> {
                    val alarms = stateJson?.optJSONArray("alarms")
                    val latest = alarms?.optJSONObject(0)
                    if (latest != null) {
                        val timeParts = latest.optString("time", "07:00").split(":")
                        val hour = timeParts.getOrNull(0)?.toIntOrNull() ?: 7
                        val min = timeParts.getOrNull(1)?.toIntOrNull() ?: 0
                        setAlarm(hour, min, latest.optString("label", "Mimi Reminder"))
                    }
                }
                "performScreenGesture" -> {
                    val gestureRaw = summary.removePrefix("Gesture: ").trim().replace(" ", "_")
                    val tapMatch = Regex("^Tapped \"(.+)\"$").find(summary)
                    if (tapMatch != null) {
                        MimiAccessibilityService.instance?.executeNavigationGesture(
                            "tap_text",
                            tapMatch.groupValues[1]
                        )
                    } else {
                        MimiAccessibilityService.instance?.executeNavigationGesture(gestureRaw)
                    }
                }
            }
        }
    }
}
