import { Suspense } from 'react';
import { FupeLogo } from '@/components/FupeLogo';
import { ThanksRedirect } from '@/components/ThanksRedirect';

export const metadata = {
  title: 'Thank you',
};

export default function ThanksPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <FupeLogo size="nav" />
      <h1 className="mt-10 text-3xl font-bold tracking-tight text-fupe-text">
        Thank you for helping us out!
      </h1>
      <p className="mt-4 text-fupe-muted">
        Your support keeps the lights on — hosting, data refresh, and making
        ownership chains easier to check.
      </p>
      <Suspense
        fallback={
          <p className="mt-8 text-sm text-fupe-muted">Preparing redirect…</p>
        }
      >
        <ThanksRedirect />
      </Suspense>
    </main>
  );
}
