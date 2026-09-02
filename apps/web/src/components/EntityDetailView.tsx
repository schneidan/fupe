'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { OwnershipChain } from '@/components/OwnershipChain';
import { CitationsList } from '@/components/CitationsList';
import { getEntity, type EntityDetail } from '@/lib/api';
import { resultPath } from '@/lib/slug';

export function EntityDetailView({ slug }: { slug: string }) {
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getEntity(slug)
      .then(setEntity)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Entity not found'),
      )
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <p className="py-20 text-center text-fupe-muted">Loading…</p>;
  }

  if (error || !entity) {
    return (
      <p className="py-12 text-center text-fupe-muted">
        {error ?? 'Not found'}.{' '}
        <Link href="/browse" className="text-fupe-text hover:underline">
          Back to directory
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-fupe-muted">
          {entity.type.replace(/_/g, ' ')}
          {entity.sector ? ` · ${entity.sector}` : ''}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-fupe-text">
          {entity.name}
        </h1>
        {entity.is_pe_backed ? (
          <p className="mt-2 text-sm font-semibold uppercase tracking-wider text-verdict-yes">
            PE-backed
          </p>
        ) : (
          <p className="mt-2 text-sm text-fupe-muted">Not PE-backed</p>
        )}
        <Link
          href={resultPath(entity.slug)}
          className="mt-4 inline-block rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted"
        >
          Is it owned by PE?
        </Link>
      </div>

      <OwnershipChain chain={entity.ownership_chain} />
      <CitationsList citations={entity.citations} />

      {entity.updated_at && (
        <p className="text-xs text-fupe-accentDim">
          Last updated {entity.updated_at}
          {entity.source ? ` · source: ${entity.source}` : ''}
        </p>
      )}
    </div>
  );
}
