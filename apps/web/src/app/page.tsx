'use client';

import { FormEvent, useState } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { LookupTabs } from '@/components/LookupTabs';
import { OwnershipCard } from '@/components/OwnershipCard';
import { lookup, lookupImage, type LookupResult } from '@/lib/api';

export default function HomePage() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runLookup(fn: () => Promise<LookupResult>) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      setResult(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    runLookup(() => lookup('TEXT', { query }));
  }

  function handleBarcode(gtin: string) {
    runLookup(() => lookup('BARCODE', { gtin }));
  }

  function handleVoice(transcript: string) {
    setQuery(transcript);
    runLookup(() => lookup('VOICE', { transcript }));
  }

  function handleImage(file: File) {
    runLookup(() => lookupImage(file));
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6">
          <h1 className="text-2xl font-bold tracking-tight text-fupe-900">
            FUPE
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Find Ultimate Parent Entity — trace ownership chains &amp; PE backing
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <LookupTabs
          onBarcode={handleBarcode}
          onVoice={handleVoice}
          onImage={handleImage}
        />

        <form onSubmit={handleSearch} className="mt-6">
          <SearchBar
            value={query}
            onChange={setQuery}
            loading={loading}
            placeholder="Search brands, companies, products…"
          />
        </form>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-6">
            <OwnershipCard result={result} />
          </div>
        )}

        {!loading && !error && !result && (
          <p className="mt-8 text-center text-sm text-slate-500">
            Search by name, scan a barcode, use voice, or upload packaging.
          </p>
        )}
      </div>
    </main>
  );
}
