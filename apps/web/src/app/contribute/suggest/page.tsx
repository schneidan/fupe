import { Suspense } from 'react';
import Link from 'next/link';
import { SuggestEditForm } from '@/components/SuggestEditForm';

export const metadata = {
  title: 'Suggest an edit',
};

export default function SuggestEditPage() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Link
        href="/contribute"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← Contribute
      </Link>
      <h1 className="text-2xl font-bold text-fupe-text">Suggest an edit</h1>
      <p className="mt-3 mb-8 text-sm text-fupe-muted">
        Ownership and PE claims require a public source URL.
      </p>
      <Suspense fallback={<p className="text-fupe-muted">Loading form…</p>}>
        <SuggestEditForm />
      </Suspense>
    </main>
  );
}
