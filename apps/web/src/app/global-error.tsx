'use client';

import { useEffect } from 'react';
import './globals.css';

/**
 * Root-layout failure boundary. Must render its own <html>/<body>.
 * Kept minimal (no shared layout chrome) so it can still boot when the
 * root layout itself is broken.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col items-center justify-center bg-[#141414] px-4 py-16 text-center text-white antialiased">
        <p
          className="text-7xl font-black leading-none tracking-tight text-[#ea580c] sm:text-8xl md:text-9xl"
          style={{ textShadow: '0 0 80px rgba(234, 88, 12, 0.45)' }}
          aria-label="503 — service unavailable"
        >
          503
        </p>
        <p className="mt-8 max-w-md text-lg text-[#a0a0a0]">
          FUPE hit a hard wall. Refresh, or come back shortly — we&apos;re
          probably already poking the ownership graph with a stick.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-[#737373]">
            Ref: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-10 rounded-full bg-white px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-[#141414]"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
