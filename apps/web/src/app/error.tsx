'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { FupeLogo } from '@/components/FupeLogo';
import { ErrorStatusHero } from '@/components/ErrorStatusHero';

export default function ErrorPage({
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
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <FupeLogo size="nav" />
      <div className="mt-12">
        <ErrorStatusHero
          code="500"
          tone="warn"
          label="500 — something went wrong"
        />
      </div>
      <p className="mt-8 text-lg text-fupe-muted">
        Something on our side tripped. Not PE&apos;s fault this time — ours.
        Try again in a moment.
      </p>
      {error.digest ? (
        <p className="mt-3 font-mono text-xs text-fupe-accentDim">
          Ref: {error.digest}
        </p>
      ) : null}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-full bg-fupe-text px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-fupe-bg transition hover:bg-fupe-accent"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-full border border-fupe-border px-6 py-2.5 text-sm font-semibold text-fupe-text transition hover:border-fupe-muted"
        >
          Search home
        </Link>
      </div>
    </main>
  );
}
