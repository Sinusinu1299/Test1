'use client';

import React from 'react';
import {
  Wifi,
  Bluetooth,
  Flashlight,
  BellOff,
  Signal,
  MapPin,
  RotateCw,
  Plane,
  Sun,
  Volume2,
  BatteryCharging,
  Battery,
  AlarmClock,
  PhoneCall,
  MessageSquare,
  ExternalLink,
  Trash2,
  Music,
  Play,
  Pause,
} from 'lucide-react';
import { ActionLogItem, PhoneState } from '@/lib/device-tools';

interface PhoneControlPanelProps {
  phoneState: PhoneState;
  actionLog: ActionLogItem[];
  onToggleSetting: (key: keyof Pick<
    PhoneState,
    'wifi' | 'bluetooth' | 'flashlight' | 'dnd' | 'mobileData' | 'location' | 'autoRotate' | 'airplaneMode'
  >) => void;
  onChangeLevel: (target: 'brightness' | 'volume', level: number) => void;
  onToggleAlarm: (id: string) => void;
  onDeleteAlarm: (id: string) => void;
  onToggleMusic: () => void;
}

const QUICK_APPS = [
  { name: 'YouTube', href: 'https://www.youtube.com', detail: 'Video & Music' },
  { name: 'WhatsApp', href: 'https://wa.me/', detail: 'Chats & Calls' },
  { name: 'Maps', href: 'https://maps.google.com', detail: 'Navigation' },
  { name: 'Spotify', href: 'https://open.spotify.com', detail: 'Audio Stream' },
];

export function PhoneControlPanel({
  phoneState,
  actionLog,
  onToggleSetting,
  onChangeLevel,
  onToggleAlarm,
  onDeleteAlarm,
  onToggleMusic,
}: PhoneControlPanelProps) {
  const toggles: {
    key: keyof Pick<
      PhoneState,
      'wifi' | 'bluetooth' | 'flashlight' | 'dnd' | 'mobileData' | 'location' | 'autoRotate' | 'airplaneMode'
    >;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { key: 'wifi', label: 'Wi-Fi', icon: Wifi },
    { key: 'bluetooth', label: 'Bluetooth', icon: Bluetooth },
    { key: 'flashlight', label: 'Flashlight', icon: Flashlight },
    { key: 'dnd', label: 'Silent / DND', icon: BellOff },
    { key: 'mobileData', label: 'Mobile Data', icon: Signal },
    { key: 'location', label: 'Location', icon: MapPin },
    { key: 'autoRotate', label: 'Auto Rotate', icon: RotateCw },
    { key: 'airplaneMode', label: 'Airplane', icon: Plane },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#121216]">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400">
            <span>Battery</span>
            {phoneState.batteryCharging ? (
              <BatteryCharging className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
            ) : (
              <Battery className="h-4 w-4 text-stone-600 dark:text-zinc-400" aria-hidden="true" />
            )}
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-stone-900 dark:text-zinc-100">
            {phoneState.batteryLevel}%
          </p>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
            {phoneState.batteryCharging ? 'Charging' : 'On battery'}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#121216]">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400">
            <span>Active App</span>
          </div>
          <p className="mt-2 truncate text-lg font-bold text-stone-900 dark:text-zinc-100">
            {phoneState.activeApp}
          </p>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
            {phoneState.flashlight ? 'Torch active' : 'Ready for command'}
          </p>
        </div>

        <div className="col-span-2 rounded-2xl border border-stone-200 bg-white p-4 sm:col-span-1 dark:border-zinc-800 dark:bg-[#121216]">
          <div className="flex items-center justify-between text-xs text-stone-500 dark:text-zinc-400">
            <span>Media Player</span>
            <Music className="h-4 w-4 text-stone-600 dark:text-zinc-400" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-stone-900 dark:text-zinc-100">
              {phoneState.currentTrack}
            </p>
            <button
              type="button"
              onClick={onToggleMusic}
              aria-label={phoneState.musicPlaying ? 'Pause music' : 'Play music'}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-stone-100 text-stone-800 hover:bg-stone-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
            >
              {phoneState.musicPlaying ? (
                <Pause className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      <section aria-labelledby="quick-toggles-heading">
        <div className="mb-3 flex items-center justify-between">
          <h3 id="quick-toggles-heading" className="text-sm font-semibold text-stone-900 dark:text-zinc-100">
            Quick Phone Controls
          </h3>
          <span className="text-xs text-stone-500 dark:text-zinc-400">
            Voice or tap to toggle
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {toggles.map((item) => {
            const Icon = item.icon;
            const active = phoneState[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onToggleSetting(item.key)}
                aria-pressed={active}
                className={`flex min-h-[56px] items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-colors active:scale-[0.98] ${
                  active
                    ? 'border-rose-200 bg-rose-600 text-white dark:border-rose-500'
                    : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50 dark:border-zinc-800 dark:bg-[#121216] dark:text-zinc-200 dark:hover:bg-zinc-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-stone-500 dark:text-zinc-400'}`}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{item.label}</div>
                  <div
                    className={`text-[11px] ${
                      active ? 'text-rose-100' : 'text-stone-500 dark:text-zinc-400'
                    }`}
                  >
                    {active ? 'On' : 'Off'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2 dark:border-zinc-800 dark:bg-[#121216]">
        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-stone-700 dark:text-zinc-300">
            <span className="inline-flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5 text-stone-500 dark:text-zinc-400" aria-hidden="true" />
              Screen Brightness
            </span>
            <span className="font-mono tabular-nums text-stone-900 dark:text-zinc-100">{phoneState.brightness}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={phoneState.brightness}
            onChange={(e) => onChangeLevel('brightness', Number(e.target.value))}
            aria-label="Screen brightness"
            className="h-2 w-full cursor-pointer accent-rose-600"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-stone-700 dark:text-zinc-300">
            <span className="inline-flex items-center gap-1.5">
              <Volume2 className="h-3.5 w-3.5 text-stone-500 dark:text-zinc-400" aria-hidden="true" />
              Media Volume
            </span>
            <span className="font-mono tabular-nums text-stone-900 dark:text-zinc-100">{phoneState.volume}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={phoneState.volume}
            onChange={(e) => onChangeLevel('volume', Number(e.target.value))}
            aria-label="Media volume"
            className="h-2 w-full cursor-pointer accent-rose-600"
          />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#121216]">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-900 dark:text-zinc-100">
              <AlarmClock className="h-4 w-4 text-stone-500 dark:text-zinc-400" aria-hidden="true" />
              Alarms
            </h4>
            <span className="text-xs tabular-nums text-stone-500 dark:text-zinc-400">
              {phoneState.alarms.length} set
            </span>
          </div>

          {phoneState.alarms.length === 0 ? (
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              No alarms set. Say &ldquo;Subah 7 baje ka alarm lagao&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-stone-100 dark:divide-zinc-800">
              {phoneState.alarms.map((alarm) => (
                <li key={alarm.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-mono text-sm font-semibold tabular-nums text-stone-900 dark:text-zinc-100">
                      {alarm.time}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">{alarm.label}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleAlarm(alarm.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium min-h-[34px] ${
                        alarm.active
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : 'bg-stone-100 text-stone-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {alarm.active ? 'Active' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAlarm(alarm.id)}
                      aria-label={`Delete alarm ${alarm.time}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#121216]">
          <h4 className="mb-3 text-sm font-semibold text-stone-900 dark:text-zinc-100">Direct App Launchers</h4>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_APPS.map((app) => (
              <a
                key={app.name}
                href={app.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[48px] items-center justify-between rounded-xl border border-stone-200 px-3 py-2 text-xs transition-colors hover:bg-stone-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-stone-900 dark:text-zinc-100">{app.name}</div>
                  <div className="truncate text-[11px] text-stone-500 dark:text-zinc-400">{app.detail}</div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-stone-400 dark:text-zinc-500" aria-hidden="true" />
              </a>
            ))}
          </div>

          {(phoneState.lastCall || phoneState.lastMessage) && (
            <div className="mt-3 space-y-1.5 border-t border-stone-100 pt-3 text-xs text-stone-600 dark:border-zinc-800 dark:text-zinc-300">
              {phoneState.lastCall && (
                <p className="flex items-center gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  <span>Last call: {phoneState.lastCall}</span>
                </p>
              )}
              {phoneState.lastMessage && (
                <p className="flex items-center gap-1.5 truncate">
                  <MessageSquare className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                  <span className="truncate">
                    To {phoneState.lastMessage.recipient}: &ldquo;{phoneState.lastMessage.text}&rdquo;
                  </span>
                </p>
              )}
            </div>
          )}
        </section>
      </div>

      {actionLog.length > 0 && (
        <section className="rounded-2xl border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#121216]">
          <h4 className="mb-2.5 text-sm font-semibold text-stone-900 dark:text-zinc-100">Recent Phone Actions</h4>
          <ul className="divide-y divide-stone-100 dark:divide-zinc-800">
            {actionLog.slice(0, 6).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                <div className="min-w-0">
                  <span className="font-medium text-stone-900 dark:text-zinc-100">{item.detail}</span>
                  <span className="mx-1.5 text-stone-300 dark:text-zinc-600" aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-stone-500 dark:text-zinc-400">{item.timestamp}</span>
                </div>
                {item.launchUri && (
                  <a
                    href={item.launchUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-rose-600 hover:underline whitespace-nowrap shrink-0 dark:text-rose-400"
                  >
                    <span>Open</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
