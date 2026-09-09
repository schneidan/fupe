import Link from 'next/link';
import type { Metadata } from 'next';
import { FupeLogo } from '@/components/FupeLogo';
import { ErrorStatusHero } from '@/components/ErrorStatusHero';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <FupeLogo size="nav" />
      <div className="mt-12">
        <ErrorStatusHero code="404" tone="error" label="404 — page not found" />
      </div>
      <p className="mt-8 text-lg text-fupe-muted">
        We traced this URL through the ownership chart. Ultimate parent:{' '}
        <span className="font-semibold text-fupe-text">nowhere</span>. It
        might be a typo — or the page got spun out and never came back.
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-fupe-text px-6 py-2.5 text-sm font-semibold uppercase tracking-wider text-fupe-bg transition hover:bg-fupe-accent"
        >
          Search home
        </Link>
        <Link
          href="/browse"
          className="rounded-full border border-fupe-border px-6 py-2.5 text-sm font-semibold text-fupe-text transition hover:border-fupe-muted"
        >
          Browse directory
        </Link>
      </div>
    </main>
  );
}
