import { Suspense } from 'react';
import { VerifyEmailClient } from '@/components/VerifyEmailClient';
import { FupeLogo } from '@/components/FupeLogo';

export const metadata = {
  title: 'Verify email',
};

export default function VerifyEmailPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="mb-6 text-2xl font-bold text-fupe-text">Verify email</h1>
      <Suspense fallback={<p className="text-fupe-muted">Loading…</p>}>
        <VerifyEmailClient />
      </Suspense>
    </main>
  );
}
