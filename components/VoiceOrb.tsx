'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { motion } from 'motion/react';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

export type AssistantPhase = 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceOrbProps {
  phase: AssistantPhase;
  voiceMuted: boolean;
  onToggleMic: () => void;
  onToggleMute: () => void;
  onStopSpeaking: () => void;
}

export function VoiceOrb({
  phase,
  voiceMuted,
  onToggleMic,
  onToggleMute,
  onStopSpeaking,
}: VoiceOrbProps) {
  const [imgFailed, setImgFailed] = useState(false);

  const statusLine =
    phase === 'listening'
      ? 'Sun rahi hoon... bolo!'
      : phase === 'thinking'
        ? 'Abhi kar rahi hoon...'
        : phase === 'speaking'
          ? 'Mimi is speaking'
          : 'Tap mic & talk to Mimi';

  return (
    <div className="flex flex-col items-center py-4">
      <div className="relative flex h-44 w-44 items-center justify-center">
        {phase !== 'idle' && (
          <>
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 rounded-full border border-rose-300/70 dark:border-rose-500/50"
              initial={{ scale: 0.92, opacity: 0.6 }}
              animate={{ scale: [0.95, 1.14, 0.95], opacity: [0.6, 0.15, 0.6] }}
              transition={{ duration: phase === 'listening' ? 1.4 : 1.9, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              aria-hidden="true"
              className="absolute inset-3 rounded-full border border-rose-400/60 dark:border-rose-400/45"
              initial={{ scale: 0.95, opacity: 0.5 }}
              animate={{ scale: [1, 1.09, 1], opacity: [0.55, 0.25, 0.55] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
            />
          </>
        )}

        <button
          type="button"
          onClick={phase === 'speaking' ? onStopSpeaking : onToggleMic}
          aria-label={
            phase === 'listening'
              ? 'Stop listening'
              : phase === 'speaking'
                ? 'Stop Mimi speaking'
                : 'Start speaking to Mimi'
          }
          className={`relative z-10 h-32 w-32 overflow-hidden rounded-full border-2 transition-transform active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#121216] ${
            phase === 'listening'
              ? 'border-rose-600 shadow-lg shadow-rose-200 dark:border-rose-500 dark:shadow-rose-950/60'
              : phase === 'speaking'
                ? 'border-rose-500 shadow-md shadow-rose-100 dark:shadow-rose-950/40'
                : 'border-stone-200 shadow-sm hover:border-rose-300 dark:border-zinc-700 dark:hover:border-rose-500/70'
          }`}
        >
          {!imgFailed ? (
            <Image
              src="/images/mimi-avatar.jpg"
              alt="Mimi AI voice companion avatar"
              fill
              priority
              sizes="128px"
              referrerPolicy="no-referrer"
              onError={() => setImgFailed(true)}
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-rose-100 to-stone-100 text-2xl font-bold text-rose-700 dark:from-rose-950 dark:to-zinc-900 dark:text-rose-300">
              Mimi
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleMute}
          aria-label={voiceMuted ? 'Unmute Mimi voice' : 'Mute Mimi voice'}
          className="absolute bottom-2 right-2 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-700 shadow-sm transition-colors hover:bg-stone-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          {voiceMuted ? (
            <VolumeX className="h-4 w-4 text-stone-500 dark:text-zinc-400" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          )}
        </button>
      </div>

      <p className="mt-2 text-sm font-medium text-stone-700 dark:text-zinc-300">{statusLine}</p>

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMic}
          className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all active:scale-[0.98] min-h-[44px] whitespace-nowrap ${
            phase === 'listening'
              ? 'bg-stone-900 text-white hover:bg-stone-800 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700'
              : 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-600/20'
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
              <span>Talk to Mimi</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
