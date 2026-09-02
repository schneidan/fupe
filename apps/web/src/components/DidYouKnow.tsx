'use client';

import Link from 'next/link';
import type { LookupResult } from '@/lib/api';

interface DidYouKnowProps {
  result: LookupResult;
}

export function DidYouKnow({ result }: DidYouKnowProps) {
  const siblings = result.related?.same_ultimate_parent ?? [];
  const similar = result.related?.similar_pe_backed ?? [];
  const peParent = result.ultimate_parent;
  const isPe = result.is_private_equity_owned;

  if (isPe && siblings.length > 0 && peParent) {
    return (
      <section className="rounded-xl border border-fupe-border bg-fupe-surface p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-fupe-muted">
          Did you know?
        </h2>
        <p className="mt-2 text-sm text-fupe-text">
          <span className="font-semibold">{result.matched_item}</span> shares
          ultimate parent{' '}
          <span className="font-semibold text-verdict-yes">
            {peParent.name}
          </span>{' '}
          with other brands:
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {siblings.map((entity) => (
            <li key={entity.id}>
              <Link
                href={`/browse/${entity.slug}`}
                className="rounded-full border border-fupe-border px-3 py-1 text-sm text-fupe-text transition hover:border-fupe-muted"
              >
                {entity.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (isPe && peParent) {
    return (
      <section className="rounded-xl border border-fupe-border border-dashed bg-fupe-surface/50 p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-fupe-muted">
          Did you know?
        </h2>
        <p className="mt-2 text-sm text-fupe-muted">
          <span className="font-semibold text-fupe-text">
            {result.matched_item}
          </span>{' '}
          sits under{' '}
          <span className="font-semibold text-fupe-text">{peParent.name}</span>.
          Explore more in the{' '}
          <Link href="/browse?pe_only=true" className="text-fupe-text hover:underline">
            PE-backed directory
          </Link>
          .
        </p>
      </section>
    );
  }

  if (!isPe && similar.length > 0) {
    return (
      <section className="rounded-xl border border-fupe-border bg-fupe-surface p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-fupe-muted">
          Did you know?
        </h2>
        <p className="mt-2 text-sm text-fupe-muted">
          Other PE-backed brands in the same sector:
        </p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {similar.slice(0, 6).map((entity) => (
            <li key={entity.id}>
              <Link
                href={`/browse/${entity.slug}`}
                className="rounded-full border border-fupe-border px-3 py-1 text-sm text-fupe-text transition hover:border-fupe-muted"
              >
                {entity.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-fupe-border border-dashed bg-fupe-surface/50 p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-fupe-muted">
        Did you know?
      </h2>
      <p className="mt-2 text-sm text-fupe-muted">
        An increasing share of household brands are PE portfolio companies.{' '}
        <Link href="/browse" className="text-fupe-text hover:underline">
          Browse the directory
        </Link>{' '}
        to explore who owns what.
      </p>
    </section>
  );
}
