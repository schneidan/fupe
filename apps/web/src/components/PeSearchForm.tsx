'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resultPath } from '@/lib/slug';

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
  const router = useRouter();

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(resultPath(trimmed));
  }

  const isHome = size === 'home';

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div
        className={`flex flex-wrap items-center justify-center gap-2 ${isHome ? 'text-xl sm:text-2xl md:text-3xl' : 'text-lg'}`}
      >
        <span className="text-fupe-text">Is</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus={autoFocus}
          className={`min-w-0 flex-1 border-b-2 border-fupe-border bg-transparent px-2 py-1 text-fupe-text outline-none transition focus:border-fupe-muted ${isHome ? 'max-w-xs sm:max-w-sm md:max-w-md' : 'max-w-[200px]'}`}
        />
        <span className="text-fupe-text">owned by PE?</span>
      </div>

      <div className={`flex justify-center ${isHome ? 'mt-10' : 'mt-6'}`}>
        <button
          type="submit"
          disabled={!query.trim()}
          className="rounded-full bg-fupe-text px-8 py-2.5 text-sm font-semibold uppercase tracking-wider text-fupe-bg transition hover:bg-fupe-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Search
        </button>
      </div>
    </form>
  );
}
