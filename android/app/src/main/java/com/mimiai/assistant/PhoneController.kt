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

    fun openOverlaySettings() {
        runCatching {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
                data = Uri.parse("package:${context.packageName}")
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
        val digitsOnly = raw.replace(Regex("[^+\\d]"), "")
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
                "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} LIKE ?",
                arrayOf("%$raw%"),
                null
            )
            cursor?.use { c ->
                if (c.moveToFirst()) {
                    val number = c.getString(1) ?: raw
                    return@runCatching number.replace(Regex("[^+\\d]"), "")
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
        val uriString = if (resolved.startsWith("tel:")) resolved else "tel:$resolved"
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
                        openUri("sms:$resolvedNumber?body=${Uri.encode(msgText)}")
                    } else if (launchUri.contains("wa.me") && resolvedNumber.any { it.isDigit() }) {
                        openUri("https://wa.me/$resolvedNumber?text=${Uri.encode(msgText)}")
                    } else if (launchUri.isNotBlank()) {
                        openUri(launchUri)
                    }
                }
                "setAlarmOrTimer" -> {
                    if (summary.startsWith("Timer set:", ignoreCase = true)) {
                        val secs = Regex("(\\d+)s").find(summary)?.groupValues?.getOrNull(1)?.toIntOrNull() ?: 60
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
                    val tapMatch = Regex("^Tapped \"(.+)\"$").find(summary)
                    val typeMatch = Regex("^Typed \"(.+)\"$").find(summary)
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
