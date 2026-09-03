import { Suspense } from 'react';
import Link from 'next/link';
import { DevelopersBilling } from '@/components/DevelopersBilling';

export const metadata = {
  title: 'Developers',
};

export default function DevelopersPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← FUPE
      </Link>
      <h1 className="text-2xl font-bold text-fupe-text">Developers</h1>
      <p className="mt-3 text-fupe-muted">
        Ownership lookup API with citation-backed chains. Free tier for
        experimentation; Developer unlocks higher limits and IMAGE lookup.
      </p>
      <Suspense fallback={<p className="mt-8 text-fupe-muted">Loading…</p>}>
        <DevelopersBilling />
      </Suspense>
    </main>
  );
}
