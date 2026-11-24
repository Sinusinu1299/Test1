'use client';

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Image from 'next/image';
import {
  Send,
  Smartphone,
  Sliders,
  MessageCircle,
  Volume2,
  Code2,
  ExternalLink,
  AlertCircle,
  Moon,
  Sun,
  UserCheck,
  Sparkles,
} from 'lucide-react';
import {
  ActionLogItem,
  ExecutedAction,
  INITIAL_PHONE_STATE,
  PhoneState,
} from '@/lib/device-tools';
import { AssistantPhase, VoiceOrb } from '@/components/VoiceOrb';
import { PhoneControlPanel } from '@/components/PhoneControlPanel';
import { AndroidProjectExport } from '@/components/AndroidProjectExport';
import { PWAInstallButton } from '@/components/PWAInstallButton';
import {
  DEFAULT_AI_NAME,
  DEFAULT_USER_NAME,
  VOICE_PERSONAS,
  getVoicePersonaConfig,
  type VoicePersonaId,
} from '@/lib/voice-personas';

const THEME_STORAGE_KEY = 'jassi-black-mode';
const USER_NAME_STORAGE_KEY = 'jassi-user-name';
const AI_NAME_STORAGE_KEY = 'jassi-ai-name';

function subscribeLocalStore(eventName: string) {
  return (callback: () => void) => {
    window.addEventListener('storage', callback);
    window.addEventListener(eventName, callback);
    return () => {
      window.removeEventListener('storage', callback);
      window.removeEventListener(eventName, callback);
    };
  };
}

const subscribeTheme = subscribeLocalStore('jassi-theme-change');
const subscribeUserName = subscribeLocalStore('jassi-user-name-change');
const subscribeAiName = subscribeLocalStore('jassi-ai-name-change');

function getThemeSnapshot(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return saved === null ? true : saved === 'true';
}

function getUserNameSnapshot(): string {
  if (typeof window === 'undefined') return DEFAULT_USER_NAME;
  return window.localStorage.getItem(USER_NAME_STORAGE_KEY) || DEFAULT_USER_NAME;
}

function getAiNameSnapshot(): string {
  if (typeof window === 'undefined') return DEFAULT_AI_NAME;
  return window.localStorage.getItem(AI_NAME_STORAGE_KEY) || DEFAULT_AI_NAME;
}

interface MessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions?: ExecutedAction[];
  launchUri?: string | null;
}

type DesktopRightTab = 'controls' | 'android';
type MobileTab = 'assistant' | 'controls' | 'android';

const QUICK_COMMANDS = [
  'Flashlight on karo',
  'Hotspot on karo',
  'YouTube par lofi chalao',
  '5 minute ka timer lagao',
  'Brightness 40% kar do',
  'Mummy ko call lagao',
  'Google pe weather search karo',
];

const CALL_ME_PRESETS = ['Kunal', 'Jaanu', 'Baby', 'Hero', 'Dost'];

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function MimiAssistantShell() {
  const blackMode = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => true);
  const userName = useSyncExternalStore(
    subscribeUserName,
    getUserNameSnapshot,
    () => DEFAULT_USER_NAME
  );
  const aiName = useSyncExternalStore(
    subscribeAiName,
    getAiNameSnapshot,
    () => DEFAULT_AI_NAME
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', blackMode);
  }, [blackMode]);

  const handleToggleBlackMode = () => {
    const next = !blackMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, String(next));
    document.documentElement.classList.toggle('dark', next);
    window.dispatchEvent(new Event('jassi-theme-change'));
  };

  const updateUserName = (nextName: string) => {
    const clean = nextName.slice(0, 24);
    if (!clean.trim()) {
      window.localStorage.removeItem(USER_NAME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(USER_NAME_STORAGE_KEY, clean);
    }
    window.dispatchEvent(new Event('jassi-user-name-change'));
  };

  const updateAiName = (nextName: string) => {
    const clean = nextName.slice(0, 24);
    if (!clean.trim()) {
      window.localStorage.removeItem(AI_NAME_STORAGE_KEY);
    } else {
      window.localStorage.setItem(AI_NAME_STORAGE_KEY, clean);
    }
    window.dispatchEvent(new Event('jassi-ai-name-change'));
  };

  const [phoneState, setPhoneState] = useState<PhoneState>(INITIAL_PHONE_STATE);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      text: getVoicePersonaConfig('all_in_one').buildGreeting(DEFAULT_AI_NAME, DEFAULT_USER_NAME),
    },
  ]);
  const [actionLog, setActionLog] = useState<ActionLogItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [phase, setPhase] = useState<AssistantPhase>('idle');
  const [persona, setPersona] = useState<VoicePersonaId>('all_in_one');
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [showCustomNamePanel, setShowCustomNamePanel] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [desktopRightTab, setDesktopRightTab] = useState<DesktopRightTab>('controls');
  const [mobileTab, setMobileTab] = useState<MobileTab>('assistant');
  const activePersonaConfig = getVoicePersonaConfig(persona);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const handleToggleMicRef = useRef<() => void>(() => {});

  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        addEventListener: (type: string, cb: () => void) => void;
        removeEventListener: (type: string, cb: () => void) => void;
      }>;
    };
    if (!nav.getBattery) return;

    let mounted = true;
    nav.getBattery().then((battery) => {
      if (!mounted) return;
      const syncBattery = () => {
        setPhoneState((prev) => ({
          ...prev,
          batteryLevel: Math.round(battery.level * 100),
          batteryCharging: battery.charging,
        }));
      };
      syncBattery();
      battery.addEventListener('levelchange', syncBattery);
      battery.addEventListener('chargingchange', syncBattery);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setPhase((prev) => (prev === 'speaking' ? 'idle' : prev));
  }, []);

  const speakWithJassiVoice = useCallback(
    async (text: string, overridePersona?: VoicePersonaId) => {
      if (voiceMuted || !text.trim()) return;
      stopAudio();
      setPhase('speaking');
      try {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, persona: overridePersona || persona }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Voice playback failed');
        }
        const audio = new Audio(`data:${data.mimeType};base64,${data.audioBase64}`);
        audioRef.current = audio;
        audio.onended = () => {
          setPhase('idle');
          audioRef.current = null;
          if (handsFree) {
            setTimeout(() => handleToggleMicRef.current(), 350);
          }
        };
        audio.onerror = () => {
          setPhase('idle');
          audioRef.current = null;
        };
        await audio.play();
      } catch (err) {
        setPhase('idle');
        setErrorMsg(err instanceof Error ? err.message : 'Unable to play cute voice.');
      }
    },
    [handsFree, persona, stopAudio, voiceMuted]
  );

  const sendCommand = useCallback(
    async (rawText: string) => {
      const command = rawText.trim();
      if (!command) return;

      setErrorMsg(null);
      setInputValue('');
      stopAudio();

      const userMsg: MessageItem = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: command,
      };
      setMessages((prev) => [...prev, userMsg]);
      setPhase('thinking');

      try {
        const history = messages.slice(-6).map((m) => ({
          role: m.role,
          text: m.text,
        }));

        const res = await fetch('/api/assistant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: command,
            persona,
            aiName,
            userName,
            history,
            phoneState,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to process command.');
        }

        if (data.updatedPhoneState) {
          setPhoneState(data.updatedPhoneState);
        }

        const executed: ExecutedAction[] = Array.isArray(data.actions) ? data.actions : [];
        if (executed.length > 0) {
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(executed[0].vibrateMs || 35);
          }
          const timeLabel = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
          setActionLog((prev) => [
            ...executed.map((act, i) => ({
              id: `act-${Date.now()}-${i}`,
              action: act.tool,
              detail: act.summary,
              timestamp: timeLabel,
              launchUri: act.launchUri,
            })),
            ...prev,
          ]);
        }

        const assistantMsg: MessageItem = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.replyText,
          actions: executed,
          launchUri: data.launchUri || null,
        };
        setMessages((prev) => [...prev, assistantMsg]);

        if (!voiceMuted) {
          await speakWithJassiVoice(data.replyText);
        } else {
          setPhase('idle');
        }
      } catch (err) {
        setPhase('idle');
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      }
    },
    [aiName, messages, persona, phoneState, speakWithJassiVoice, stopAudio, userName, voiceMuted]
  );

  const startFallbackRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = String(reader.result || '');
          const base64 = dataUrl.split(',')[1] || '';
          if (!base64) {
            setPhase('idle');
            return;
          }
          setPhase('thinking');
          try {
            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                audioBase64: base64,
                mimeType: recorder.mimeType || 'audio/webm',
              }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Transcription failed.');
            if (data.text) {
              await sendCommand(data.text);
            } else {
              setPhase('idle');
            }
          } catch (err) {
            setPhase('idle');
            setErrorMsg(err instanceof Error ? err.message : 'Could not hear audio.');
          }
        };
        reader.readAsDataURL(blob);
      };

      recorder.start();
      setPhase('listening');
    } catch {
      setPhase('idle');
      setErrorMsg(
        `Mic is preview iframe mein block ho sakta hai — Chrome Site Settings mein Microphone allow karo, ya neeche type/tap karke ${aiName} ki cute voice suno!`
      );
    }
  };

  const handleToggleMic = () => {
    setErrorMsg(null);
    if (phase === 'listening') {
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setPhase('idle');
      return;
    }

    stopAudio();

    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionInstanceLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.lang = 'en-IN';
        rec.interimResults = false;
        rec.maxAlternatives = 1;
        recognitionRef.current = rec;
        setPhase('listening');

        rec.onresult = (event) => {
          const transcript = event.results?.[0]?.[0]?.transcript || '';
          if (transcript.trim()) {
            void sendCommand(transcript);
          } else {
            setPhase('idle');
          }
        };

        rec.onerror = (ev) => {
          if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
            setPhase('idle');
            setErrorMsg(
              `Mic access preview iframe mein blocked hai — Chrome lock icon se Microphone allow karo ya standalone Android APK/tab mein kholo. Tab tak type ya Quick Commands try karo!`
            );
          } else {
            void startFallbackRecording();
          }
        };

        rec.onend = () => {
          setPhase((prev) => (prev === 'listening' ? 'idle' : prev));
        };

        rec.start();
        return;
      } catch {
        // Fallback below
      }
    }

    void startFallbackRecording();
  };

  useEffect(() => {
    handleToggleMicRef.current = handleToggleMic;
  });

  const handleToggleSetting = (
    key: keyof Pick<
      PhoneState,
      | 'wifi'
      | 'bluetooth'
      | 'flashlight'
      | 'dnd'
      | 'mobileData'
      | 'location'
      | 'autoRotate'
      | 'airplaneMode'
      | 'hotspot'
      | 'batterySaver'
    >
  ) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(25);
    }
    setPhoneState((prev) => {
      const nextVal = !prev[key];
      const next: PhoneState = { ...prev, [key]: nextVal };
      if (key === 'airplaneMode' && nextVal) {
        next.wifi = false;
        next.mobileData = false;
        next.bluetooth = false;
        next.hotspot = false;
      }
      return next;
    });
  };

  const handleChangeLevel = (target: 'brightness' | 'volume', level: number) => {
    setPhoneState((prev) => ({
      ...prev,
      [target]: level,
    }));
  };

  const handleToggleAlarm = (id: string) => {
    setPhoneState((prev) => ({
      ...prev,
      alarms: prev.alarms.map((a) => (a.id === id ? { ...a, active: !a.active } : a)),
    }));
  };

  const handleDeleteAlarm = (id: string) => {
    setPhoneState((prev) => ({
      ...prev,
      alarms: prev.alarms.filter((a) => a.id !== id),
    }));
  };

  const handleToggleMusic = () => {
    setPhoneState((prev) => ({
      ...prev,
      musicPlaying: !prev.musicPlaying,
    }));
  };

  const navigateToSection = (target: 'assistant' | 'controls' | 'android') => {
    setMobileTab(target);
    if (target === 'controls' || target === 'android') {
      setDesktopRightTab(target);
    }
  };

  const handleSelectPersona = (nextId: VoicePersonaId) => {
    setPersona(nextId);
    const nextCfg = getVoicePersonaConfig(nextId);
    setMessages((prev) => [
      ...prev,
      {
        id: `mode-${Date.now()}`,
        role: 'assistant',
        text: nextCfg.buildGreeting(aiName, userName),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-[#FAF8F7] text-stone-900 pb-20 lg:pb-8 dark:bg-[#09090B] dark:text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#FAF8F7]/90 backdrop-blur-md dark:border-zinc-800/80 dark:bg-[#09090B]/90">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6">
          <a
            href="#top"
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0 dark:text-zinc-100"
          >
            <Image
              src="/images/jassi-logo.jpg"
              alt="Jassi AI logo"
              width={30}
              height={30}
              className="rounded-lg border border-rose-500/40 object-cover"
              referrerPolicy="no-referrer"
            />
            <span>{aiName} AI</span>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600 dark:text-zinc-400">
            <button
              type="button"
              onClick={() => navigateToSection('assistant')}
              className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0 dark:hover:text-zinc-100"
            >
              Assistant
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('controls')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                desktopRightTab === 'controls'
                  ? 'text-stone-900 underline decoration-rose-500 decoration-2 underline-offset-4 dark:text-zinc-100'
                  : 'hover:text-stone-900 dark:hover:text-zinc-100'
              }`}
            >
              A-to-Z Controls
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('android')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                desktopRightTab === 'android'
                  ? 'text-stone-900 underline decoration-rose-500 decoration-2 underline-offset-4 dark:text-zinc-100'
                  : 'hover:text-stone-900 dark:hover:text-zinc-100'
              }`}
            >
              Android App
            </button>
          </nav>

          <div className="shrink-0">
            <PWAInstallButton onOpenAndroidTab={() => navigateToSection('android')} />
          </div>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:py-8">
        <section
          aria-label={`${aiName} Voice Assistant`}
          className={`lg:col-span-5 ${mobileTab === 'assistant' ? 'block' : 'hidden lg:block'}`}
        >
          <div className="flex flex-col rounded-3xl border border-stone-200 bg-white p-5 shadow-xs dark:border-zinc-800 dark:bg-[#121216]">
            <div className="flex items-start justify-between gap-2 border-b border-stone-100 pb-3 dark:border-zinc-800">
              <div className="min-w-0">
                <h1 className="text-lg font-bold tracking-tight text-stone-900 dark:text-zinc-100">
                  {aiName} · Companion for {userName}
                </h1>
                <p className="truncate text-xs text-stone-500 dark:text-zinc-400">
                  {activePersonaConfig.tagline}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCustomNamePanel((v) => !v)}
                  aria-label="Customize AI & User Name"
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                    showCustomNamePanel
                      ? 'border-rose-500 bg-rose-600 text-white'
                      : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
                  }`}
                >
                  <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{userName}</span>
                </button>
                <button
                  type="button"
                  onClick={handleToggleBlackMode}
                  aria-label={blackMode ? 'Switch to Light Mode' : 'Switch to Black Mode'}
                  className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {blackMode ? (
                    <Sun className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                  ) : (
                    <Moon className="h-3.5 w-3.5 text-stone-700" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {showCustomNamePanel && (
              <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/90">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-stone-600 dark:text-zinc-400">
                      Call Me (Custom Name)
                    </label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => updateUserName(e.target.value)}
                      placeholder="Kunal"
                      className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:border-rose-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold text-stone-600 dark:text-zinc-400">
                      AI Girl Name
                    </label>
                    <input
                      type="text"
                      value={aiName}
                      onChange={(e) => updateAiName(e.target.value)}
                      placeholder="Jassi"
                      className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-900 focus:border-rose-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-stone-500 dark:text-zinc-400">Presets:</span>
                  {CALL_ME_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => updateUserName(preset)}
                      className={`rounded-lg px-2 py-1 text-[11px] font-medium ${
                        userName === preset
                          ? 'bg-rose-600 text-white'
                          : 'bg-white text-stone-700 border border-stone-200 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
              {VOICE_PERSONAS.map((vp) => {
                const active = persona === vp.id;
                return (
                  <button
                    key={vp.id}
                    type="button"
                    onClick={() => handleSelectPersona(vp.id)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                      active
                        ? 'border-rose-500 bg-rose-600 text-white'
                        : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {vp.shortLabel}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setHandsFree((h) => !h)}
                aria-pressed={handsFree}
                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[34px] ${
                  handsFree
                    ? 'border-emerald-500 bg-emerald-600 text-white'
                    : 'border-stone-200 bg-stone-50 text-stone-700 hover:bg-stone-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
                }`}
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                <span>Hands-Free</span>
              </button>
            </div>

            <VoiceOrb
              phase={phase}
              voiceMuted={voiceMuted}
              aiName={aiName}
              userName={userName}
              onToggleMic={handleToggleMic}
              onToggleMute={() => {
                if (!voiceMuted) stopAudio();
                setVoiceMuted((v) => !v);
              }}
              onStopSpeaking={stopAudio}
            />

            {errorMsg && (
              <div
                role="alert"
                className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-200"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="mt-2 max-h-[260px] space-y-3 overflow-y-auto pr-1">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-stone-900 text-white dark:bg-rose-600 dark:text-white'
                        : 'bg-stone-100 text-stone-900 dark:border dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100'
                    }`}
                  >
                    <p>{msg.text}</p>

                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-2 border-t border-stone-200/80 pt-1.5 text-xs text-stone-600 dark:border-zinc-800 dark:text-zinc-400">
                        {msg.actions.map((act, i) => (
                          <p key={i} className="font-medium">
                            {act.summary}
                          </p>
                        ))}
                      </div>
                    )}

                    {msg.role === 'assistant' && (
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void speakWithJassiVoice(msg.text)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline dark:text-rose-400"
                        >
                          <Volume2 className="h-3 w-3" aria-hidden="true" />
                          <span>Speak again</span>
                        </button>
                        {msg.launchUri && (
                          <a
                            href={msg.launchUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-800 hover:underline dark:text-zinc-200"
                          >
                            <span>Open on Phone</span>
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd}
                  type="button"
                  onClick={() => void sendCommand(cmd)}
                  disabled={phase === 'thinking'}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 whitespace-nowrap shrink-0 min-h-[38px] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-rose-500/50 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                >
                  {cmd}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendCommand(inputValue);
              }}
              className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3 dark:border-zinc-800"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={`Bolo ${aiName} ko, ${userName}... (e.g. Hotspot on karo)`}
                aria-label={`Type a voice or text command for ${aiName}`}
                className="min-h-[44px] flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-400 focus:bg-white focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-rose-500 dark:focus:bg-zinc-900"
              />
              <button
                type="submit"
                disabled={phase === 'thinking' || !inputValue.trim()}
                aria-label="Send command"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>

        <section
          aria-label="Phone Control Center and Android App Export"
          className={`mt-6 lg:col-span-7 lg:mt-0 ${
            mobileTab === 'controls' || mobileTab === 'android' ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="mb-5 hidden lg:flex items-center justify-between gap-4">
            <div className="inline-flex items-center gap-1 rounded-xl bg-stone-200/70 p-1 dark:bg-zinc-900 dark:border dark:border-zinc-800">
              <button
                type="button"
                onClick={() => navigateToSection('controls')}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  desktopRightTab === 'controls'
                    ? 'bg-white text-stone-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                <span>A-to-Z Phone Control</span>
              </button>
              <button
                type="button"
                onClick={() => navigateToSection('android')}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  desktopRightTab === 'android'
                    ? 'bg-white text-stone-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Android APK &amp; GitHub</span>
              </button>
            </div>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              {desktopRightTab === 'controls'
                ? `Synced live with ${aiName} commands`
                : 'Debug APK & GitHub Releases CI'}
            </p>
          </div>

          {(mobileTab === 'controls' || (mobileTab === 'assistant' && desktopRightTab === 'controls')) && (
            <PhoneControlPanel
              phoneState={phoneState}
              actionLog={actionLog}
              onToggleSetting={handleToggleSetting}
              onChangeLevel={handleChangeLevel}
              onToggleAlarm={handleToggleAlarm}
              onDeleteAlarm={handleDeleteAlarm}
              onToggleMusic={handleToggleMusic}
            />
          )}

          {(mobileTab === 'android' || (mobileTab === 'assistant' && desktopRightTab === 'android')) && (
            <AndroidProjectExport />
          )}
        </section>
      </main>

      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-3 items-center border-t border-stone-200 bg-white/95 backdrop-blur-md lg:hidden dark:border-zinc-800 dark:bg-[#09090B]/95"
      >
        <button
          type="button"
          onClick={() => navigateToSection('assistant')}
          className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
            mobileTab === 'assistant' ? 'text-rose-600 dark:text-rose-400' : 'text-stone-500 dark:text-zinc-400'
          }`}
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          <span>{aiName}</span>
        </button>

        <button
          type="button"
          onClick={() => navigateToSection('controls')}
          className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
            mobileTab === 'controls' ? 'text-rose-600 dark:text-rose-400' : 'text-stone-500 dark:text-zinc-400'
          }`}
        >
          <Sliders className="h-5 w-5" aria-hidden="true" />
          <span>Controls</span>
        </button>

        <button
          type="button"
          onClick={() => navigateToSection('android')}
          className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
            mobileTab === 'android' ? 'text-rose-600 dark:text-rose-400' : 'text-stone-500 dark:text-zinc-400'
          }`}
        >
          <Smartphone className="h-5 w-5" aria-hidden="true" />
          <span>Android App</span>
        </button>
      </nav>
    </div>
  );
}
