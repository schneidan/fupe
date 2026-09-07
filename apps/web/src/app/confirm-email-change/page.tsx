import { Suspense } from 'react';
import { ConfirmEmailChangeClient } from '@/components/ConfirmEmailChangeClient';
import { FupeLogo } from '@/components/FupeLogo';

export const metadata = {
  title: 'Confirm email change',
};

export default function ConfirmEmailChangePage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="mb-6 text-2xl font-bold text-fupe-text">
        Confirm email change
      </h1>
      <Suspense fallback={<p className="text-fupe-muted">Loading…</p>}>
        <ConfirmEmailChangeClient />
      </Suspense>
    </main>
  );
}
