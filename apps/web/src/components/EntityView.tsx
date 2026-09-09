'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PeSearchForm } from '@/components/PeSearchForm';
import { VerdictHero } from '@/components/VerdictHero';
import { OwnershipChain } from '@/components/OwnershipChain';
import { CitationsList, isWeakEvidence } from '@/components/CitationsList';
import { DidYouKnow } from '@/components/DidYouKnow';
import { SuggestEditLink } from '@/components/SuggestEditLink';
import { EntityModeratorPanel } from '@/components/EntityModeratorPanel';
import { lookup, type LookupResult } from '@/lib/api';
import {
  getStoredUser,
  isModerator,
  type AuthUser,
} from '@/lib/auth';
import { entityPath, slugToQuery, toSlug } from '@/lib/slug';

interface EntityViewProps {
  slug: string;
  /** Server-fetched result for SSR / crawlers + fast first paint */
  initialResult?: LookupResult | null;
}

/**
 * Single entity detail surface for search and browse.
 * Resolves via TEXT lookup so fuzzy/search-origin slugs still work, then
 * canonicalizes the URL to the matched entity slug.
 */
export function EntityView({ slug, initialResult = null }: EntityViewProps) {
  const router = useRouter();
  const query = slugToQuery(slug);
  const [result, setResult] = useState<LookupResult | null>(initialResult);
  const [loading, setLoading] = useState(!initialResult);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [modPanelOpen, setModPanelOpen] = useState(false);

  useEffect(() => {
    function syncUser() {
      setUser(getStoredUser());
    }
    syncUser();
    window.addEventListener('fupe-auth', syncUser);
    return () => window.removeEventListener('fupe-auth', syncUser);
  }, []);

  useEffect(() => {
    if (!query) {
      setLoading(false);
      setError('No search query provided.');
      return;
    }

    // Already have SSR data for this slug — just canonicalize URL if needed.
    if (initialResult && toSlug(initialResult.matched_item) === slug) {
      setResult(initialResult);
      setLoading(false);
      setError(null);
      return;
    }

    if (initialResult && toSlug(initialResult.matched_item) !== slug) {
      const canonical = toSlug(initialResult.matched_item);
      if (canonical) {
        router.replace(entityPath(initialResult.matched_item));
      }
      setResult(initialResult);
      setLoading(false);
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
          router.replace(entityPath(data.matched_item));
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
  }, [query, slug, router, initialResult]);

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
        <p className="text-lg text-status-error">{error ?? 'Not found'}</p>
        {isNotFound && (
          <p className="mt-2 text-sm text-fupe-muted">
            No match in our directory yet. Try a different spelling,{' '}
            <Link href="/contribute/suggest-entity" className="text-fupe-text hover:underline">
              suggest an entity
            </Link>
            , or{' '}
            <Link href="/contribute" className="text-fupe-text hover:underline">
              contribute
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

  const showModEdit = isModerator(user) && Boolean(result.entity_id);
  const weak = isWeakEvidence(result.citations);

  return (
    <div className="space-y-8">
      <VerdictHero result={result} weakEvidence={weak} />
      <OwnershipChain chain={result.ownership_chain} currentSlug={slug} />
      <CitationsList citations={result.citations} />
      <SuggestEditLink
        entityId={result.entity_id}
        name={result.matched_item}
      />
      {showModEdit && result.entity_id && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setModPanelOpen(true)}
            className="inline-block rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-muted transition hover:border-fupe-muted hover:text-fupe-text"
          >
            Edit entity
          </button>
          <p className="mt-2 text-xs text-fupe-accentDim">
            Moderator: change details or delete
          </p>
        </div>
      )}
      <DidYouKnow result={result} />
      <div className="border-t border-fupe-border pt-8">
        <p className="mb-4 text-center text-sm text-fupe-muted">
          Search another
        </p>
        <PeSearchForm size="compact" />
      </div>

      {result.entity_id && (
        <EntityModeratorPanel
          entityId={result.entity_id}
          open={modPanelOpen}
          onClose={() => setModPanelOpen(false)}
        />
      )}
    </div>
  );
}
