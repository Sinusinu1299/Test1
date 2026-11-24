package com.mimiai.assistant

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
