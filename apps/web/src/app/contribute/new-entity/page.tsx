import { Suspense } from 'react';
import Link from 'next/link';
import { ProposeEntityForm } from '@/components/ProposeEntityForm';

export const metadata = {
  title: 'Propose new entity',
};

export default function ProposeEntityPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Link
        href="/contribute"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← Contribute
      </Link>
      <h1 className="text-2xl font-bold text-fupe-text">Propose new entity</h1>
      <p className="mt-3 mb-8 text-sm text-fupe-muted">
        Add a brand or company missing from the directory. A moderator must
        approve before it appears in browse and lookup.
      </p>
      <Suspense fallback={<p className="text-fupe-muted">Loading form…</p>}>
        <ProposeEntityForm />
      </Suspense>
    </main>
  );
}
