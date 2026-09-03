import { Suspense } from 'react';
import { BrowseDirectory } from '@/components/BrowseDirectory';
import { FupeLogo } from '@/components/FupeLogo';

export default function BrowsePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="text-2xl font-bold text-fupe-text">Browse directory</h1>
      <p className="mt-2 text-sm text-fupe-muted">
        Search brands, subsidiaries, and PE firms in our graph.
      </p>
      <div className="mt-8">
        <Suspense
          fallback={
            <p className="text-center text-fupe-muted">Loading directory…</p>
          }
        >
          <BrowseDirectory />
        </Suspense>
      </div>
    </main>
  );
}
