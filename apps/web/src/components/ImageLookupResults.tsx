'use client';

import Link from 'next/link';
import { entityPath } from '@/lib/slug';
import type { LookupResult } from '@/lib/api';

interface ImageLookupResultsProps {
  interpretation: string;
  results: LookupResult[];
  onDismiss?: () => void;
}

export function ImageLookupResults({
  interpretation,
  results,
  onDismiss,
}: ImageLookupResultsProps) {
  return (
    <div className="mx-auto mt-8 w-full max-w-xl text-left">
      <p className="text-center text-base text-fupe-muted">
        It looks like you&rsquo;re sharing a picture of{' '}
        <span className="text-fupe-text">{interpretation}</span>.
      </p>
      <p className="mt-2 text-center text-sm text-fupe-accentDim">
        Here&rsquo;s what we found:
      </p>

      {results.length === 0 ? (
        <p className="mt-6 text-center text-fupe-muted">
          Nothing matched our directory yet. Try a clearer photo or{' '}
          <Link href="/contribute" className="text-fupe-text hover:underline">
            contribute
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-6 divide-y divide-fupe-border border-y border-fupe-border">
          {results.map((r) => (
            <li key={r.entity_id ?? r.matched_item}>
              <Link
                href={entityPath(r.matched_item)}
                className="flex items-baseline justify-between gap-4 py-4 transition hover:bg-fupe-surface/60"
              >
                <span className="text-lg text-fupe-text">{r.matched_item}</span>
                <span
                  className={`shrink-0 text-sm font-semibold uppercase tracking-wider ${
                    r.is_private_equity_owned
                      ? 'text-verdict-yes'
                      : 'text-verdict-no'
                  }`}
                >
                  {r.is_private_equity_owned ? 'PE-backed' : 'Not PE'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {onDismiss && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onDismiss}
            className="text-sm text-fupe-muted hover:text-fupe-text"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
