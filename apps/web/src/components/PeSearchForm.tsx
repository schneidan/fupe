'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { searchHits } from '@/lib/api';
import {
  preferSimplestFamilyHit,
  selectAutoMatchHit,
  pathForSearchHit,
  type SearchHit,
} from '@/lib/search';

interface PeSearchFormProps {
  defaultQuery?: string;
  autoFocus?: boolean;
  size?: 'home' | 'compact';
}

export function PeSearchForm({
  defaultQuery = '',
  autoFocus = false,
  size = 'home',
}: PeSearchFormProps) {
  const [query, setQuery] = useState(defaultQuery);
  const [suggestions, setSuggestions] = useState<SearchHit[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [didYouMean, setDidYouMean] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();
  const listId = useId();
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqSeq = useRef(0);

  const isHome = size === 'home';

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setActiveIndex(-1);
      return;
    }

    const seq = ++reqSeq.current;
    const handle = setTimeout(() => {
      void searchHits(trimmed).then((hits) => {
        if (seq !== reqSeq.current) return;
        setSuggestions(preferSimplestFamilyHit(trimmed, hits).slice(0, 8));
        setActiveIndex(-1);
      });
    }, 200);

    return () => clearTimeout(handle);
  }, [query]);

  async function runSearch(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;

    setSearching(true);
    setDidYouMean(null);
    try {
      const hits = await searchHits(trimmed);
      const auto = selectAutoMatchHit(trimmed, hits);
      if (auto) {
        setShowSuggestions(false);
        router.push(pathForSearchHit(auto));
        return;
      }
      setDidYouMean(preferSimplestFamilyHit(trimmed, hits).slice(0, 8));
      setShowSuggestions(false);
    } finally {
      setSearching(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runSearch(query);
  }

  function pickHit(hit: SearchHit) {
    setShowSuggestions(false);
    setDidYouMean(null);
    setQuery(hit.name);
    router.push(pathForSearchHit(hit));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!showSuggestions || !suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pickHit(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="w-full">
        <div
          className={`flex flex-wrap items-center justify-center gap-2 ${isHome ? 'text-xl sm:text-2xl md:text-3xl' : 'text-lg'}`}
        >
          <span className="text-fupe-text">Is</span>
          <div
            className={`relative min-w-0 flex-1 ${isHome ? 'max-w-xs sm:max-w-sm md:max-w-md' : 'max-w-[200px]'}`}
          >
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setDidYouMean(null);
                setShowSuggestions(true);
              }}
              onFocus={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                setShowSuggestions(true);
              }}
              onBlur={() => {
                blurTimer.current = setTimeout(
                  () => setShowSuggestions(false),
                  150,
                );
              }}
              onKeyDown={onKeyDown}
              autoFocus={autoFocus}
              autoComplete="off"
              role="combobox"
              aria-label="Brand, product, or company name"
              aria-expanded={showSuggestions && suggestions.length > 0}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={
                activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined
              }
              className="w-full border-b-2 border-fupe-border bg-transparent px-2 py-1 text-fupe-text outline-none transition focus:border-fupe-muted"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul
                id={listId}
                role="listbox"
                className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-lg border border-fupe-border bg-fupe-surface text-left text-sm shadow-lg"
              >
                {suggestions.map((hit, i) => (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <button
                      type="button"
                      id={`${listId}-opt-${i}`}
                      role="option"
                      aria-selected={i === activeIndex}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition ${
                        i === activeIndex
                          ? 'bg-fupe-elevated text-fupe-text'
                          : 'text-fupe-text hover:bg-fupe-elevated'
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickHit(hit)}
                    >
                      <span className="truncate font-medium">{hit.name}</span>
                      <span className="shrink-0 text-xs uppercase tracking-wide text-fupe-accentDim">
                        {hit.kind === 'product'
                          ? 'product'
                          : (hit.type ?? 'entity').replace(/_/g, ' ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="sr-only" aria-live="polite">
              {searching
                ? 'Searching'
                : showSuggestions && suggestions.length > 0
                  ? `${suggestions.length} suggestions available`
                  : didYouMean
                    ? didYouMean.length > 0
                      ? `${didYouMean.length} close matches`
                      : 'No close matches'
                    : ''}
            </p>
          </div>
          <span className="text-fupe-text">owned by PE?</span>
        </div>

        <div className={`flex justify-center ${isHome ? 'mt-10' : 'mt-6'}`}>
          <button
            type="submit"
            disabled={!query.trim() || searching}
            className="rounded-full bg-fupe-text px-8 py-2.5 text-sm font-semibold uppercase tracking-wider text-fupe-bg transition hover:bg-fupe-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {didYouMean && (
        <div
          className={`mx-auto max-w-lg text-left ${isHome ? 'mt-8' : 'mt-6'}`}
        >
          {didYouMean.length > 0 ? (
            <>
              <p className="text-sm font-semibold text-fupe-text">
                Did you mean?
              </p>
              <ul className="mt-3 divide-y divide-fupe-border rounded-lg border border-fupe-border bg-fupe-surface">
                {didYouMean.map((hit) => (
                  <li key={`dym-${hit.kind}-${hit.id}`}>
                    <button
                      type="button"
                      onClick={() => pickHit(hit)}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition hover:bg-fupe-elevated"
                    >
                      <span className="font-medium text-fupe-text">
                        {hit.name}
                      </span>
                      <span className="text-xs uppercase tracking-wide text-fupe-accentDim">
                        {hit.kind === 'product'
                          ? 'product'
                          : (hit.type ?? 'entity').replace(/_/g, ' ')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-center text-sm text-fupe-muted">
              No close matches for &ldquo;{query.trim()}&rdquo;.
            </p>
          )}
          <p className="mt-4 text-center text-xs leading-relaxed text-fupe-muted">
            If it isn&apos;t in this list, we may not have it yet. Try{' '}
            <Link
              href="/browse"
              className="text-fupe-text underline decoration-fupe-border underline-offset-2 hover:decoration-fupe-muted"
            >
              browsing
            </Link>{' '}
            our complete database or{' '}
            <Link
              href="/contribute/suggest-entity"
              className="text-fupe-text underline decoration-fupe-border underline-offset-2 hover:decoration-fupe-muted"
            >
              suggest an addition here
            </Link>
            .
          </p>
        </div>
      )}
    </div>
  );
}
