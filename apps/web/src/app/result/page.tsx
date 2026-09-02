'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { PeSearchForm } from '@/components/PeSearchForm';
import { VerdictHero } from '@/components/VerdictHero';
import { OwnershipChain } from '@/components/OwnershipChain';
import { CitationsList } from '@/components/CitationsList';
import { DidYouKnow } from '@/components/DidYouKnow';
import { lookup, type LookupResult } from '@/lib/api';

function ResultContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.trim()) {
      setLoading(false);
      setError('No search query provided.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    lookup('TEXT', { query: q })
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Lookup failed');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [q]);

  if (!q.trim()) {
    return (
      <p className="text-center text-fupe-muted">
        <Link href="/" className="text-fupe-accent hover:underline">
          Go back
        </Link>{' '}
        and enter a brand or company.
      </p>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-fupe-muted border-t-transparent" />
        <p className="text-fupe-muted">Tracing ownership for &ldquo;{q}&rdquo;…</p>
      </div>
    );
  }

  if (error || !result) {
    const isNotFound = error?.toLowerCase().includes('no match');
    return (
      <div className="py-12 text-center">
        <p className="text-lg text-verdict-yes">{error ?? 'Not found'}</p>
        {isNotFound && (
          <p className="mt-2 text-sm text-fupe-muted">
            No match in our directory yet. Try a different spelling or{' '}
            <Link href="/contribute" className="text-fupe-text hover:underline">
              add it
            </Link>
            .
          </p>
        )}
        <div className="mt-8">
          <PeSearchForm defaultQuery={q} size="compact" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <VerdictHero result={result} />
      <OwnershipChain chain={result.ownership_chain} />
      <CitationsList citations={result.citations} />
      <DidYouKnow result={result} />
      <div className="border-t border-fupe-border pt-8">
        <p className="mb-4 text-center text-sm text-fupe-muted">
          Search another
        </p>
        <PeSearchForm size="compact" />
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← FUPE
      </Link>
      <Suspense
        fallback={
          <div className="py-20 text-center text-fupe-muted">Loading…</div>
        }
      >
        <ResultContent />
      </Suspense>
    </main>
  );
}
