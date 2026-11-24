'use client';

import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import {
  Check,
  Copy,
  Download,
  FileCode2,
  GitBranch,
  ShieldCheck,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { buildAndroidProjectFiles } from '@/lib/android-project';
import { usePWAInstall } from '@/hooks/use-pwa-install';

export function AndroidProjectExport() {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [copiedAdb, setCopiedAdb] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [apkReady, setApkReady] = useState(false);

  const originUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-uuzky3ypgmgghwvfuuhcqc-347265722576.asia-east1.run.app';

  const projectFiles = useMemo(() => buildAndroidProjectFiles(originUrl), [originUrl]);
  const activeFile = projectFiles[selectedIdx] || projectFiles[0];

  useEffect(() => {
    let active = true;
    fetch('/api/android-apk', { method: 'HEAD' })
      .then((res) => {
        if (active) setApkReady(res.ok);
      })
      .catch(() => {
        if (active) setApkReady(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(activeFile.content);
    setCopiedPath(activeFile.path);
    setTimeout(() => setCopiedPath(null), 1800);
  };

  const handleCopyAdb = async () => {
    await navigator.clipboard.writeText(
      'cd android && ./gradlew assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk'
    );
    setCopiedAdb(true);
    setTimeout(() => setCopiedAdb(false), 1800);
  };

  const handleDownloadZip = async () => {
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      for (const file of projectFiles) {
        zip.file(file.path, file.content);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'MimiAI-Android-GitHub-Ready.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2.5">
            <Terminal className="h-5 w-5 text-rose-600" aria-hidden="true" />
            <h3 className="text-base font-bold text-stone-900">1. Direct Debug APK</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Configured with <code className="font-mono text-xs">isDebuggable = true</code> and Accessibility control. Build locally with Gradle or deploy directly via USB/ADB debugging.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {apkReady ? (
              <a
                href="/api/android-apk"
                download="mimi-ai-debug.apk"
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 min-h-[44px]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download Debug APK</span>
              </a>
            ) : (
              <span className="text-xs font-medium text-stone-500">
                Build via GitHub Actions or <code className="font-mono">./gradlew assembleDebug</code>
              </span>
            )}
            <button
              type="button"
              onClick={handleCopyAdb}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 min-h-[44px]"
            >
              {copiedAdb ? (
                <>
                  <Check className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                  <span>ADB Cmd Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copy ADB Command</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2.5">
            <GitBranch className="h-5 w-5 text-rose-600" aria-hidden="true" />
            <h3 className="text-base font-bold text-stone-900">2. GitHub Auto-Build &amp; Install</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            Includes <code className="font-mono text-xs">.github/workflows/android-debug-apk.yml</code>. Push to GitHub and download <code className="font-mono text-xs">mimi-ai-debug-apk</code> from the Actions tab on your phone.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-60 min-h-[44px]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{downloadingZip ? 'Preparing ZIP...' : 'Download GitHub-Ready ZIP'}</span>
            </button>

            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 min-h-[44px]"
              >
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Install PWA</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-600">
        <div className="flex items-center gap-2 font-semibold text-stone-900">
          <ShieldCheck className="h-4 w-4 text-rose-600" aria-hidden="true" />
          <span>Phone Debugging &amp; GitHub Install Steps</span>
        </div>
        <ol className="mt-2 grid gap-1.5 sm:grid-cols-3">
          <li>1. Enable <strong>Install unknown apps</strong> (for GitHub APK) or <strong>USB Debugging</strong> (for ADB).</li>
          <li>2. Install <code className="font-mono">app-debug.apk</code> and grant Mic, Camera &amp; Phone permissions.</li>
          <li>3. Open <strong>Enable Accessibility Service</strong> inside Mimi AI to allow full phone control.</li>
        </ol>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-rose-600" aria-hidden="true" />
            <span className="text-sm font-semibold text-stone-900">Android Project &amp; CI Files</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 min-h-[36px]"
          >
            {copiedPath === activeFile.path ? (
              <>
                <Check className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy File</span>
              </>
            )}
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto border-b border-stone-100 bg-stone-50 px-4 py-2">
          {projectFiles.map((file, idx) => {
            const shortName = file.path.split('/').pop() || file.path;
            const active = idx === selectedIdx;
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 min-h-[36px] ${
                  active
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {shortName}
              </button>
            );
          })}
        </div>

        <div className="border-b border-stone-100 px-4 py-2.5 text-xs text-stone-600">
          <span className="font-mono text-stone-500">{activeFile.path}</span>
          <span className="mx-2 text-stone-300" aria-hidden="true">·</span>
          <span>{activeFile.description}</span>
        </div>

        <pre className="max-h-[380px] overflow-auto bg-stone-950 p-4 font-mono text-xs leading-relaxed text-stone-100">
          <code>{activeFile.content}</code>
        </pre>
      </div>
    </div>
  );
}
