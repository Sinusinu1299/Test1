'use client';

import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/use-pwa-install';

interface PWAInstallButtonProps {
  onOpenAndroidTab?: () => void;
}

export function PWAInstallButton({ onOpenAndroidTab }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-700 active:scale-[0.98] whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{isInstallable ? 'Install Jassi' : isIOS ? 'Install on iOS' : 'Get Android App'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm dark:bg-black/75"
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-guide-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-[#121216]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                  <Smartphone className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h3 id="install-guide-title" className="text-base font-bold text-stone-900 dark:text-zinc-100">
                    Install Jassi AI on Your Phone
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-zinc-400">
                    {isIOS ? 'iPhone & iPad Safari' : 'Android Chrome & GitHub APK'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Close install guide"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2.5 text-sm text-stone-700 dark:text-zinc-300">
                <li>1. Tap the <strong>Share</strong> icon in the Safari toolbar.</li>
                <li>2. Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>3. Tap <strong>Add</strong> to launch Jassi AI as a standalone app.</li>
              </ol>
            ) : (
              <div className="mt-4 space-y-3 text-sm text-stone-700 dark:text-zinc-300">
                <p>
                  <strong>Instant Home-Screen App:</strong> Open this URL in Android Chrome, tap the menu (three dots), and choose <strong>Install app</strong>.
                </p>
                <p>
                  <strong>Full A-to-Z Phone Control APK:</strong> Download the built APK directly from GitHub Releases or export the Android project.
                </p>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              {!isIOS && onOpenAndroidTab && (
                <button
                  type="button"
                  onClick={() => {
                    setShowGuide(false);
                    onOpenAndroidTab();
                  }}
                  className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 whitespace-nowrap"
                >
                  Open Android APK &amp; GitHub
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="rounded-xl border border-stone-200 px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 whitespace-nowrap dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
