'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Send,
  Smartphone,
  Sliders,
  MessageCircle,
  Volume2,
  Code2,
  ExternalLink,
  AlertCircle,
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
import type { VoicePersonaId } from '@/app/api/tts/route';

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
  'Brightness 35% kar do',
  'YouTube par lofi chalao',
  'Subah 6:30 ka alarm lagao',
  'Silent mode on karo',
  'Mummy ko call lagao',
];

const VOICE_PERSONAS: { id: VoicePersonaId; label: string }[] = [
  { id: 'bubbly', label: 'Cute & Bubbly' },
  { id: 'sweet', label: 'Sweet & Warm' },
  { id: 'calm', label: 'Soft & Gentle' },
];

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
  const [phoneState, setPhoneState] = useState<PhoneState>(INITIAL_PHONE_STATE);
  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      text: 'Hii! Main Mimi hoon. Aapka phone mere control mein hai — bolo kya karna hai?',
    },
  ]);
  const [actionLog, setActionLog] = useState<ActionLogItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [phase, setPhase] = useState<AssistantPhase>('idle');
  const [persona, setPersona] = useState<VoicePersonaId>('bubbly');
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [desktopRightTab, setDesktopRightTab] = useState<DesktopRightTab>('controls');
  const [mobileTab, setMobileTab] = useState<MobileTab>('assistant');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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

  const speakWithMimiVoice = useCallback(
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
    [persona, stopAudio, voiceMuted]
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
          await speakWithMimiVoice(data.replyText);
        } else {
          setPhase('idle');
        }
      } catch (err) {
        setPhase('idle');
        setErrorMsg(err instanceof Error ? err.message : 'Something went wrong.');
      }
    },
    [messages, phoneState, speakWithMimiVoice, stopAudio, voiceMuted]
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
      setErrorMsg('Microphone access was blocked. Please allow mic permission or type below.');
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
            setErrorMsg('Microphone permission denied. Please allow mic access or type below.');
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

  const handleToggleSetting = (
    key: keyof Pick<
      PhoneState,
      'wifi' | 'bluetooth' | 'flashlight' | 'dnd' | 'mobileData' | 'location' | 'autoRotate' | 'airplaneMode'
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

  return (
    <div className="min-h-screen bg-[#FAF8F7] text-stone-900 pb-20 lg:pb-8">
      <header className="sticky top-0 z-30 border-b border-stone-200/80 bg-[#FAF8F7]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6">
          <a
            href="#top"
            className="text-lg font-bold tracking-tight text-stone-900 whitespace-nowrap shrink-0"
          >
            Mimi AI
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600">
            <button
              type="button"
              onClick={() => navigateToSection('assistant')}
              className="hover:text-stone-900 transition-colors whitespace-nowrap shrink-0"
            >
              Assistant
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('controls')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                desktopRightTab === 'controls'
                  ? 'text-stone-900 underline decoration-rose-500 decoration-2 underline-offset-4'
                  : 'hover:text-stone-900'
              }`}
            >
              Phone Controls
            </button>
            <button
              type="button"
              onClick={() => navigateToSection('android')}
              className={`transition-colors whitespace-nowrap shrink-0 ${
                desktopRightTab === 'android'
                  ? 'text-stone-900 underline decoration-rose-500 decoration-2 underline-offset-4'
                  : 'hover:text-stone-900'
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
          aria-label="Mimi Voice Assistant"
          className={`lg:col-span-5 ${mobileTab === 'assistant' ? 'block' : 'hidden lg:block'}`}
        >
          <div className="flex flex-col rounded-3xl border border-stone-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <h1 className="text-lg font-bold tracking-tight text-stone-900">
                  Mimi Voice Companion
                </h1>
                <p className="text-xs text-stone-500">
                  Hinglish &amp; Hindi · Cute Girl Voice
                </p>
              </div>
              <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1">
                {VOICE_PERSONAS.map((vp) => (
                  <button
                    key={vp.id}
                    type="button"
                    onClick={() => setPersona(vp.id)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                      persona === vp.id
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {vp.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>

            <VoiceOrb
              phase={phase}
              voiceMuted={voiceMuted}
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
                className="mb-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
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
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-900'
                    }`}
                  >
                    <p>{msg.text}</p>

                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-2 border-t border-stone-200/80 pt-1.5 text-xs text-stone-600">
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
                          onClick={() => void speakWithMimiVoice(msg.text)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline"
                        >
                          <Volume2 className="h-3 w-3" aria-hidden="true" />
                          <span>Speak again</span>
                        </button>
                        {msg.launchUri && (
                          <a
                            href={msg.launchUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-800 hover:underline"
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
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 whitespace-nowrap shrink-0 min-h-[38px]"
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
              className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Bolo Mimi ko... (e.g. Wi-Fi off karo)"
                aria-label="Type a voice or text command for Mimi"
                className="min-h-[44px] flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-sm text-stone-900 placeholder:text-stone-400 focus:border-rose-400 focus:bg-white focus:outline-none"
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
            <div className="inline-flex items-center gap-1 rounded-xl bg-stone-200/70 p-1">
              <button
                type="button"
                onClick={() => navigateToSection('controls')}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  desktopRightTab === 'controls'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Sliders className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Phone Control Center</span>
              </button>
              <button
                type="button"
                onClick={() => navigateToSection('android')}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  desktopRightTab === 'android'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Android APK &amp; GitHub</span>
              </button>
            </div>
            <p className="text-xs text-stone-500">
              {desktopRightTab === 'controls'
                ? 'Synced live with Mimi commands'
                : 'Debug APK & GitHub Actions CI'}
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
        className="fixed bottom-0 left-0 right-0 z-40 grid h-16 grid-cols-3 items-center border-t border-stone-200 bg-white/95 backdrop-blur-md lg:hidden"
      >
        <button
          type="button"
          onClick={() => navigateToSection('assistant')}
          className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
            mobileTab === 'assistant' ? 'text-rose-600' : 'text-stone-500'
          }`}
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          <span>Assistant</span>
        </button>

        <button
          type="button"
          onClick={() => navigateToSection('controls')}
          className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
            mobileTab === 'controls' ? 'text-rose-600' : 'text-stone-500'
          }`}
        >
          <Sliders className="h-5 w-5" aria-hidden="true" />
          <span>Controls</span>
        </button>

        <button
          type="button"
          onClick={() => navigateToSection('android')}
          className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${
            mobileTab === 'android' ? 'text-rose-600' : 'text-stone-500'
          }`}
        >
          <Smartphone className="h-5 w-5" aria-hidden="true" />
          <span>Android App</span>
        </button>
      </nav>
    </div>
  );
}
