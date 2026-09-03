import { Suspense } from 'react';
import { DevelopersBilling } from '@/components/DevelopersBilling';
import { DevelopersApiDocs } from '@/components/DevelopersApiDocs';
import { FupeLogo } from '@/components/FupeLogo';

export const metadata = {
  title: 'Developers',
};

export default function DevelopersPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="text-2xl font-bold text-fupe-text">Developers</h1>
      <p className="mt-3 text-fupe-muted">
        Ownership lookup API with citation-backed chains. Free tier for
        experimentation; Developer unlocks higher limits and IMAGE lookup.
      </p>
      <Suspense fallback={<p className="mt-8 text-fupe-muted">Loading…</p>}>
        <DevelopersBilling />
      </Suspense>
      <div className="mt-12 border-t border-fupe-border pt-10">
        <DevelopersApiDocs />
      </div>
    </main>
  );
}
