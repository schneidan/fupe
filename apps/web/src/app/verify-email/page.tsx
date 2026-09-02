import { Suspense } from 'react';
import Link from 'next/link';
import { VerifyEmailClient } from '@/components/VerifyEmailClient';

export const metadata = {
  title: 'Verify email',
};

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← FUPE
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-fupe-text">Verify email</h1>
      <Suspense fallback={<p className="text-fupe-muted">Loading…</p>}>
        <VerifyEmailClient />
      </Suspense>
    </main>
  );
}
