import { Suspense } from 'react';
import Link from 'next/link';
import { SuggestEntityForm } from '@/components/SuggestEntityForm';

export const metadata = {
  title: 'Suggest an entity',
};

export default function SuggestEntityPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Link
        href="/contribute"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← Contribute
      </Link>
      <h1 className="text-2xl font-bold text-fupe-text">Suggest an entity</h1>
      <p className="mt-3 mb-8 text-sm text-fupe-muted">
        Spot a brand or company that&apos;s missing? Drop the name — we&apos;ll
        queue it for enrichment. No citation or ownership details required.
      </p>
      <Suspense fallback={<p className="text-fupe-muted">Loading form…</p>}>
        <SuggestEntityForm />
      </Suspense>
    </main>
  );
}
