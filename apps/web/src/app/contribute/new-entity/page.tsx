import { Suspense } from 'react';
import Link from 'next/link';
import { ProposeEntityForm } from '@/components/ProposeEntityForm';

export const metadata = {
  title: 'Add entity',
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
      <h1 className="text-2xl font-bold text-fupe-text">Add entity</h1>
      <p className="mt-3 mb-8 text-sm text-fupe-muted">
        Full details when you know them: type, optional parent/sector, and a
        citation. New entities always go to a moderator for review. Just have a
        name?{' '}
        <Link
          href="/contribute/suggest-entity"
          className="text-fupe-text hover:underline"
        >
          Suggest an entity
        </Link>{' '}
        instead.
      </p>
      <Suspense fallback={<p className="text-fupe-muted">Loading form…</p>}>
        <ProposeEntityForm />
      </Suspense>
    </main>
  );
}
