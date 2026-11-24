'use client';

import React, { useEffect, useMemo, useState } from 'react';
import JSZip from 'jszip';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
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
  const [copiedGit, setCopiedGit] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [apkReady, setApkReady] = useState(false);
  const [githubRepo, setGithubRepo] = useState('Sinusinu1299/Test1');

  const originUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://ais-pre-uuzky3ypgmgghwvfuuhcqc-347265722576.asia-east1.run.app';

  const projectFiles = useMemo(() => buildAndroidProjectFiles(originUrl), [originUrl]);
  const activeFile = projectFiles[selectedIdx] || projectFiles[0];

  const cleanRepoSlug = githubRepo
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .replace(/^\/+|\/+$/g, '');

  const gitPushCommand = cleanRepoSlug
    ? `git remote add origin https://github.com/${cleanRepoSlug}.git || git remote set-url origin https://github.com/${cleanRepoSlug}.git\ngit add -A && git commit -m "Jassi AI: Custom Kunal Calling, Animated Voice & A-to-Z Phone Control" && git push -u origin main`
    : `git add -A && git commit -m "Jassi AI: Custom Kunal Calling, Animated Voice & A-to-Z Phone Control"\ngit remote add origin https://github.com/<USERNAME>/<REPO>.git && git push -u origin main`;

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
      'cd android && gradle assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk'
    );
    setCopiedAdb(true);
    setTimeout(() => setCopiedAdb(false), 1800);
  };

  const handleCopyGit = async () => {
    await navigator.clipboard.writeText(gitPushCommand);
    setCopiedGit(true);
    setTimeout(() => setCopiedGit(false), 1800);
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
      a.download = 'JassiAI-Android-GitHub-Ready.zip';
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
        <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#121216]">
          <div className="flex items-center gap-2.5">
            <Terminal className="h-5 w-5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">1. Direct Debug APK</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
            Configured with <code className="font-mono text-xs text-stone-800 dark:text-zinc-200">isDebuggable = true</code>, Jassi Portrait &amp; App Logo, Custom Name Calling, and A-to-Z Phone Access.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            {apkReady ? (
              <a
                href="/api/android-apk"
                download="jassi-ai-debug.apk"
                className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-rose-700 min-h-[44px]"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Download Debug APK</span>
              </a>
            ) : (
              <span className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                Build via GitHub Actions or <code className="font-mono">gradle assembleDebug</code>
              </span>
            )}
            <button
              type="button"
              onClick={handleCopyAdb}
              className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 min-h-[44px] dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {copiedAdb ? (
                <>
                  <Check className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
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

        <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#121216]">
          <div className="flex items-center gap-2.5">
            <GitBranch className="h-5 w-5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
            <h3 className="text-base font-bold text-stone-900 dark:text-zinc-100">2. GitHub Auto-Build &amp; Debug</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-zinc-400">
            Includes <code className="font-mono text-xs text-stone-800 dark:text-zinc-200">.github/workflows/android-debug-apk.yml</code> with <code className="font-mono text-xs">lintDebug</code>, APK artifact &amp; debug reports.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={downloadingZip}
              className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-60 min-h-[44px] dark:bg-rose-600 dark:hover:bg-rose-700"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>{downloadingZip ? 'Preparing ZIP...' : 'Download GitHub-Ready ZIP'}</span>
            </button>

            {!isInstalled && isInstallable && (
              <button
                type="button"
                onClick={install}
                className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3.5 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 min-h-[44px] dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Install PWA</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-5 dark:border-zinc-800 dark:bg-[#121216]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-stone-900 dark:text-zinc-100">
              GitHub Push &amp; Debug Actions Shortcut
            </h3>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-zinc-400">
              Enter your GitHub <code className="font-mono">username/repo</code> to generate exact push commands &amp; APK build links.
            </p>
          </div>
          {cleanRepoSlug && (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={`https://github.com/${cleanRepoSlug}/actions/workflows/android-debug-apk.yml`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700"
              >
                <span>Open GitHub Actions</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
              <a
                href={`https://github.com/${cleanRepoSlug}/releases`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                <span>Releases</span>
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            placeholder="e.g. rahul/mimi-ai-android"
            aria-label="GitHub username and repository"
            className="min-h-[42px] flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-rose-400 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:bg-zinc-900"
          />
          <button
            type="button"
            onClick={handleCopyGit}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50 min-h-[42px] dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {copiedGit ? (
              <>
                <Check className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
                <span>Git Push Cmd Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy GitHub Push Cmd</span>
              </>
            )}
          </button>
        </div>

        <pre className="mt-3 overflow-x-auto rounded-xl bg-stone-950 p-3 font-mono text-[11px] leading-relaxed text-stone-200 dark:bg-[#050507] dark:border dark:border-zinc-800">
          <code>{gitPushCommand}</code>
        </pre>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-4 text-xs text-stone-600 dark:border-zinc-800 dark:bg-[#121216] dark:text-zinc-400">
        <div className="flex items-center gap-2 font-semibold text-stone-900 dark:text-zinc-100">
          <ShieldCheck className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
          <span>Phone Debugging &amp; GitHub Install Steps</span>
        </div>
        <ol className="mt-2 grid gap-1.5 sm:grid-cols-3">
          <li>1. Enable <strong>Install unknown apps</strong> (for GitHub APK) or <strong>USB Debugging</strong> (for ADB).</li>
          <li>2. Install <code className="font-mono text-stone-800 dark:text-zinc-200">jassi-ai-debug.apk</code> from <strong>Releases</strong> or <strong>jassi-ai-debug-apk</strong> artifact.</li>
          <li>3. Tap <strong>Enable A-to-Z Accessibility Service</strong> inside Jassi AI for full phone control.</li>
        </ol>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-zinc-800 dark:bg-[#121216]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <FileCode2 className="h-4 w-4 text-rose-600 dark:text-rose-400" aria-hidden="true" />
            <span className="text-sm font-semibold text-stone-900 dark:text-zinc-100">Android Project &amp; CI Files</span>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 min-h-[36px] dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {copiedPath === activeFile.path ? (
              <>
                <Check className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" aria-hidden="true" />
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

        <div className="flex gap-1.5 overflow-x-auto border-b border-stone-100 bg-stone-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
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
                    ? 'bg-white text-stone-900 shadow-xs dark:bg-zinc-800 dark:text-zinc-100'
                    : 'text-stone-600 hover:text-stone-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {shortName}
              </button>
            );
          })}
        </div>

        <div className="border-b border-stone-100 px-4 py-2.5 text-xs text-stone-600 dark:border-zinc-800 dark:text-zinc-400">
          <span className="font-mono text-stone-500 dark:text-zinc-300">{activeFile.path}</span>
          <span className="mx-2 text-stone-300 dark:text-zinc-600" aria-hidden="true">·</span>
          <span>{activeFile.description}</span>
        </div>

        <pre className="max-h-[380px] overflow-auto bg-stone-950 p-4 font-mono text-xs leading-relaxed text-stone-100 dark:bg-[#050507]">
          <code>{activeFile.content}</code>
        </pre>
      </div>
    </div>
  );
}
