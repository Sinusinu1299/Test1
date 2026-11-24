# Mimi AI — Voice Phone Assistant & Android App

Mimi AI is a bilingual (Hinglish, Hindi, English) voice phone assistant with a cute female voice powered by Gemini (`gemini-4-hydrogen`, `gemini-3.8-flash-lite-tts`, `gemini-3.5-transcribe`), paired with a native Android Accessibility companion app.

## Project Structure

- `app/`, `components/`, `lib/` — Next.js 15 PWA & backend API routes (`/api/assistant`, `/api/tts`, `/api/transcribe`, `/api/android-apk`)
- `android/` — Native Kotlin Jetpack Compose Android app with `AccessibilityService`, `PhoneController`, and `isDebuggable = true`
- `.github/workflows/android-debug-apk.yml` — Automatic GitHub Actions Debug APK builder & artifact uploader

---

## Option 1: Install APK from GitHub Actions (No PC Setup Needed)

1. Push this repository to GitHub (or trigger **Actions > Build Android Debug APK > Run workflow**).
2. Open the completed workflow run under the **Actions** tab on GitHub.
3. Under **Artifacts**, download **`mimi-ai-debug-apk`** (`app-debug.apk`).
4. Open `app-debug.apk` on your Android phone and allow **Install unknown apps** when prompted.

---

## Option 2: Direct USB / Wireless Debugging (ADB)

Enable **Developer Options > USB Debugging** on your Android phone, connect via USB (or `adb pair`), and run:

```bash
cd android
gradle assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.mimiai.assistant/.MainActivity
```

---

## First-Time Phone Permissions

Inside the **Mimi AI** Android app:
1. Allow **Microphone**, **Phone**, and **Camera** permissions.
2. Tap **1. Enable Accessibility Service** and switch **Mimi AI** ON (for Home/Back/Scroll/Screen-Tap control).
3. Tap **2. Brightness Perm** and **3. Silent / DND Perm** for hardware system control.
