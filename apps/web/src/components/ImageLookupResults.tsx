'use client';

import Link from 'next/link';
import { entityPath } from '@/lib/slug';
import type { LookupResult } from '@/lib/api';

interface ImageLookupResultsProps {
  interpretation: string;
  results: LookupResult[];
  unmatchedGuesses?: string[];
  onDismiss?: () => void;
}

export function ImageLookupResults({
  interpretation,
  results,
  unmatchedGuesses = [],
  onDismiss,
}: ImageLookupResultsProps) {
  const suggestHref = (name: string) =>
    `/contribute/suggest-entity?name=${encodeURIComponent(name)}`;

  return (
    <div className="mx-auto mt-8 w-full max-w-xl text-left">
      <p className="text-center text-base text-fupe-muted">
        It looks like you&rsquo;re sharing a picture of{' '}
        <span className="text-fupe-text">{interpretation}</span>.
      </p>

      {results.length > 0 ? (
        <>
          <p className="mt-4 text-center text-sm text-fupe-accentDim">
            {results.length === 1
              ? 'Is this what you meant?'
              : 'Did you mean one of these?'}
          </p>
          <ul className="mt-4 divide-y divide-fupe-border border-y border-fupe-border">
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
        </>
      ) : (
        <p className="mt-6 text-center text-fupe-muted">
          Nothing in our directory matched this photo yet.
        </p>
      )}

      {unmatchedGuesses.length > 0 ? (
        <div className="mt-8">
          <p className="text-center text-sm text-fupe-accentDim">
            {results.length > 0
              ? 'Also spotted on the packaging (not in FUPE yet):'
              : 'Names we spotted (not in FUPE yet):'}
          </p>
          <ul className="mt-3 space-y-2">
            {unmatchedGuesses.map((name) => (
              <li
                key={name}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-fupe-border bg-fupe-surface px-4 py-3"
              >
                <span className="text-fupe-text">{name}</span>
                <span className="flex flex-wrap gap-3 text-sm">
                  <Link
                    href={`/entity?q=${encodeURIComponent(name)}`}
                    className="text-fupe-muted hover:text-fupe-text hover:underline"
                  >
                    Search
                  </Link>
                  <Link
                    href={suggestHref(name)}
                    className="text-fupe-text hover:underline"
                  >
                    Suggest addition
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {results.length === 0 && unmatchedGuesses.length === 0 ? (
        <p className="mt-4 text-center text-sm text-fupe-muted">
          Try a clearer photo of the brand logo, or{' '}
          <Link href="/contribute" className="text-fupe-text hover:underline">
            contribute
          </Link>
          .
        </p>
      ) : null}

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
