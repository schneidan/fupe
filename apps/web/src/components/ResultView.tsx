'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PeSearchForm } from '@/components/PeSearchForm';
import { VerdictHero } from '@/components/VerdictHero';
import { OwnershipChain } from '@/components/OwnershipChain';
import { CitationsList } from '@/components/CitationsList';
import { DidYouKnow } from '@/components/DidYouKnow';
import { SuggestEditLink } from '@/components/SuggestEditLink';
import { lookup, type LookupResult } from '@/lib/api';
import { resultPath, slugToQuery, toSlug } from '@/lib/slug';

interface ResultViewProps {
  slug: string;
}

export function ResultView({ slug }: ResultViewProps) {
  const router = useRouter();
  const query = slugToQuery(slug);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      setError('No search query provided.');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    lookup('TEXT', { query })
      .then((data) => {
        if (cancelled) return;
        setResult(data);
        const canonical = toSlug(data.matched_item);
        if (canonical && canonical !== slug) {
          router.replace(resultPath(data.matched_item));
        }
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
  }, [query, slug, router]);

  if (!query) {
    return (
      <p className="text-center text-fupe-muted">
        <Link href="/" className="text-fupe-text hover:underline">
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
        <p className="text-fupe-muted">Tracing ownership for &ldquo;{query}&rdquo;…</p>
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
          <PeSearchForm defaultQuery={query} size="compact" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <VerdictHero result={result} />
      <OwnershipChain chain={result.ownership_chain} />
      <CitationsList citations={result.citations} />
      <SuggestEditLink
        entityId={result.entity_id}
        name={result.matched_item}
      />
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
