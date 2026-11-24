'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

export type AssistantPhase = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceOrbProps {
  phase: AssistantPhase;
  voiceMuted: boolean;
  aiName: string;
  userName: string;
  onToggleMic: () => void;
  onToggleMute: () => void;
  onStopSpeaking: () => void;
}

const WAVE_BARS = [
  { delay: 0, peak: 22 },
  { delay: 0.12, peak: 34 },
  { delay: 0.24, peak: 28 },
  { delay: 0.08, peak: 38 },
  { delay: 0.2, peak: 26 },
  { delay: 0.14, peak: 32 },
  { delay: 0.28, peak: 20 },
];

export function VoiceOrb({
  phase,
  voiceMuted,
  aiName,
  userName,
  onToggleMic,
  onToggleMute,
  onStopSpeaking,
}: VoiceOrbProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const statusLine =
    phase === 'listening'
      ? `Sun rahi hoon ${userName}... bolo!`
      : phase === 'thinking'
        ? `Abhi kar rahi hoon ${userName}...`
        : phase === 'speaking'
          ? `${aiName} is talking to ${userName}`
          : `Tap mic & talk to ${aiName}`;

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative flex h-48 w-48 items-center justify-center">
        {/* Ambient glow aura */}
        <motion.div
          aria-hidden="true"
          className="absolute inset-4 rounded-full bg-rose-500/20 blur-2xl dark:bg-rose-500/25"
          animate={
            phase === 'speaking'
              ? { scale: [1, 1.24, 1.05, 1.2, 1], opacity: [0.45, 0.9, 0.55, 0.85, 0.45] }
              : phase === 'listening'
                ? { scale: [1, 1.18, 1], opacity: [0.4, 0.75, 0.4] }
                : { scale: [0.96, 1.04, 0.96], opacity: [0.22, 0.38, 0.22] }
          }
          transition={{
            duration: phase === 'speaking' ? 0.9 : 2.4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Thinking orbital ring */}
        {phase === 'thinking' && (
          <motion.div
            aria-hidden="true"
            className="absolute inset-2 rounded-full border-2 border-transparent border-t-rose-500 border-r-rose-400/70"
            animate={{ rotate: 360 }}
            transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* Active listening / speaking sonar rings */}
        {(phase === 'listening' || phase === 'speaking') && (
          <>
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-rose-400/70 dark:border-rose-500/60"
              initial={{ scale: 0.88, opacity: 0.7 }}
              animate={{ scale: [0.92, 1.18, 0.92], opacity: [0.7, 0.12, 0.7] }}
              transition={{
                duration: phase === 'speaking' ? 0.95 : 1.4,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
            <motion.div
              aria-hidden="true"
              className="absolute inset-3 rounded-full border border-rose-500/60 dark:border-rose-400/50"
              initial={{ scale: 0.94, opacity: 0.6 }}
              animate={{ scale: [0.98, 1.1, 0.98], opacity: [0.65, 0.2, 0.65] }}
              transition={{
                duration: phase === 'speaking' ? 0.7 : 1.15,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: 0.15,
              }}
            />
          </>
        )}

        {/* Animated Portrait Orb */}
        <motion.div
          animate={
            phase === 'speaking'
              ? { scale: [1, 1.045, 0.99, 1.035, 1] }
              : phase === 'listening'
                ? { scale: [1, 1.02, 1] }
                : { y: [0, -2.5, 0] }
          }
          transition={{
            duration: phase === 'speaking' ? 0.65 : 3.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="relative z-10"
        >
          <button
            type="button"
            onClick={phase === 'speaking' ? onStopSpeaking : onToggleMic}
            aria-label={
              phase === 'listening'
                ? 'Stop listening'
                : phase === 'speaking'
                  ? `Stop ${aiName} speaking`
                  : `Start speaking to ${aiName}`
            }
            className={`relative h-36 w-36 overflow-hidden rounded-full border-2 transition-colors active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121216] ${
              phase === 'listening'
                ? 'border-rose-600 shadow-lg shadow-rose-500/30 dark:border-rose-500'
                : phase === 'speaking'
                  ? 'border-rose-500 shadow-xl shadow-rose-500/40'
                  : 'border-stone-200 shadow-md hover:border-rose-400 dark:border-zinc-700 dark:hover:border-rose-500/80'
            }`}
          >
            {!imgFailed ? (
              <Image
                src="/images/jassi-avatar.jpg"
                alt={`${aiName} AI voice companion portrait`}
                fill
                priority
                sizes="144px"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-100 to-stone-100 text-2xl font-bold text-rose-700 dark:from-rose-950 dark:to-zinc-900 dark:text-rose-300">
                {aiName}
              </div>
            )}
          </button>
        </motion.div>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={voiceMuted ? `Unmute ${aiName} voice` : `Mute ${aiName} voice`}
          className="absolute bottom-3 right-3 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 shadow-sm transition-colors hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {voiceMuted ? (
            <VolumeX className="h-4 w-4 text-stone-500 dark:text-zinc-400" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Live Animated Talking / Listening Waveform Equalizer */}
      <div className="mt-1 flex h-8 items-center justify-center gap-1" aria-hidden="true">
        {WAVE_BARS.map((bar, idx) => (
          <motion.span
            key={idx}
            className={`w-1 rounded-full ${
              phase === 'speaking'
                ? 'bg-rose-500'
                : phase === 'listening'
                  ? 'bg-rose-400'
                  : 'bg-stone-300 dark:bg-zinc-700'
            }`}
            animate={
              phase === 'speaking'
                ? { height: [6, bar.peak, 10, bar.peak * 0.75, 6] }
                : phase === 'listening'
                  ? { height: [5, bar.peak * 0.55, 5] }
                  : { height: 5 }
            }
            transition={{
              duration: phase === 'speaking' ? 0.52 : 0.9,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: bar.delay,
            }}
          />
        ))}
      </div>

      <p className="mt-1 text-sm font-medium text-stone-700 dark:text-zinc-300">{statusLine}</p>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMic}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] min-h-[44px] whitespace-nowrap ${
            phase === 'listening'
              ? 'bg-stone-900 text-white hover:bg-stone-800 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
              : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-600/25'
          }`}
        >
          {phase === 'listening' ? (
            <>
              <MicOff className="h-4 w-4" aria-hidden="true" />
              <span>Stop Listening</span>
            </>
          ) : (
            <>
              <Mic className="h-4 w-4" aria-hidden="true" />
              <span>Talk to {aiName}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
