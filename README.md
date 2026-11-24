# Jassi AI — Voice Phone Companion & Android App

Jassi AI is a bilingual (Hinglish, Hindi, English) voice companion powered by Gemini (`gemini-4-hydrogen`, `gemini-3.8-flash-lite-tts`, `gemini-3.5-transcribe`), paired with a native Android Accessibility & Hardware control app featuring custom name calling (`Kunal`, never `Boss`), talking animations, Black Mode, and A-to-Z phone access.

## Project Structure

- `app/`, `components/`, `lib/` — Next.js 15 PWA & backend API routes (`/api/assistant`, `/api/tts`, `/api/transcribe`, `/api/android-apk`)
- `android/` — Native Kotlin Jetpack Compose Android app with `AccessibilityService`, `PhoneController` (Contacts, Camera/Selfie, Timers, Torch, Media Keys, System Panels), custom launcher icons, and `isDebuggable = true`
- `.github/workflows/android-debug-apk.yml` — Automatic GitHub Actions Debug APK builder, artifact uploader & GitHub Releases publisher

---

## Option 1: Install APK from GitHub Releases (No PC Setup Needed)

1. Push this repository to GitHub (or trigger **Actions > Build & Release Android Debug APK > Run workflow**).
2. Open the **Releases** section on the right side of the GitHub repo (or **Actions > Artifacts > `jassi-ai-debug-apk`**).
3. Download **`jassi-ai-debug.apk`** directly on your Android phone and tap it to install (allow **Install unknown apps** if prompted).

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

## First-Time A-to-Z Phone Permissions

Inside the **Jassi AI** Android app:
1. Tap **Grant Basic** to allow **Microphone**, **Phone**, **Contacts**, **SMS**, and **Camera**.
2. Tap **1. Enable A-to-Z Accessibility Service** and switch **Jassi AI** ON (for Home, Back, Quick Settings, Split Screen, Screenshots, Lock Screen, Tap, Scroll & Voice Typing).
3. Tap **2. Brightness**, **3. Silent/DND**, and **4. Overlay** for full hardware & screen control.
