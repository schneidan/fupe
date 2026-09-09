'use client';

import { useState } from 'react';

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

interface ShareEntityButtonProps {
  title: string;
  text: string;
  /** Absolute or path URL; defaults to current page */
  url?: string;
}

export function ShareEntityButton({
  title,
  text,
  url,
}: ShareEntityButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'shared' | 'error'>(
    'idle',
  );

  async function resolveUrl(): Promise<string> {
    if (url?.startsWith('http')) return url;
    if (typeof window === 'undefined') return url ?? '';
    if (url) return new URL(url, window.location.origin).toString();
    return window.location.href;
  }

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setStatus('copied');
    } catch {
      setStatus('error');
    }
    window.setTimeout(() => setStatus('idle'), 2000);
  }

  async function onShare() {
    const link = await resolveUrl();
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.share === 'function'
    ) {
      try {
        await navigator.share({ title, text, url: link });
        setStatus('shared');
        window.setTimeout(() => setStatus('idle'), 2000);
        return;
      } catch (err) {
        // User cancel — stay quiet; other errors fall through to copy.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    await copyLink(link);
  }

  async function onCopy() {
    await copyLink(await resolveUrl());
  }

  const statusLabel =
    status === 'copied'
      ? 'Link copied'
      : status === 'shared'
        ? 'Shared'
        : status === 'error'
          ? "Couldn't copy"
          : null;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void onShare()}
          className="inline-flex items-center gap-2 rounded-full border border-fupe-border px-4 py-2 text-sm text-fupe-text transition hover:border-fupe-muted hover:bg-fupe-surface"
          aria-label="Share this result"
        >
          <ShareIcon className="h-4 w-4" />
          Share
        </button>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="rounded-full border border-transparent px-3 py-2 text-xs text-fupe-muted transition hover:text-fupe-text"
        >
          Copy link
        </button>
      </div>
      {statusLabel ? (
        <p className="text-xs text-fupe-muted" aria-live="polite">
          {statusLabel}
        </p>
      ) : null}
    </div>
  );
}
