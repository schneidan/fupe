import type { Metadata } from 'next';
import { FupeLogo } from '@/components/FupeLogo';
import { UnsubscribeClient } from './UnsubscribeClient';

export const metadata: Metadata = {
  title: 'Unsubscribe',
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col px-4 py-16">
      <FupeLogo size="nav" />
      <h1 className="mt-10 text-2xl font-bold text-fupe-text">
        Email preferences
      </h1>
      <UnsubscribeClient />
    </main>
  );
}
