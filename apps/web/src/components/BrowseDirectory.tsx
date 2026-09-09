'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { listEntities, type EntitySummary } from '@/lib/api';
import { entityPath } from '@/lib/slug';

const ENTITY_TYPES = [
  { value: '', label: 'All types' },
  { value: 'BRAND', label: 'Brand' },
  { value: 'SUBSIDIARY', label: 'Subsidiary' },
  { value: 'PE_FIRM', label: 'PE firm' },
  { value: 'VC_FIRM', label: 'VC firm' },
];

const COUNTRIES = [
  { value: '', label: 'All countries' },
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  { value: 'DE', label: 'Germany' },
  { value: 'FR', label: 'France' },
];

export function BrowseDirectory() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchId = useId();
  const typeId = useId();
  const countryId = useId();

  const [qInput, setQInput] = useState(searchParams.get('q') ?? '');
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [type, setType] = useState(searchParams.get('type') ?? '');
  const [country, setCountry] = useState(searchParams.get('country') ?? '');
  const [peOnly, setPeOnly] = useState(searchParams.get('pe_only') === 'true');
  const [page, setPage] = useState(
    Math.max(1, Number(searchParams.get('page') || '1') || 1),
  );
  const [items, setItems] = useState<EntitySummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const qReady = useRef(false);

  const limit = 20;

  useEffect(() => {
    const handle = setTimeout(() => {
      setQ(qInput.trim());
    }, 300);
    return () => clearTimeout(handle);
  }, [qInput]);

  useEffect(() => {
    if (!qReady.current) {
      qReady.current = true;
      return;
    }
    setPage(1);
  }, [q]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    if (country) params.set('country', country);
    if (peOnly) params.set('pe_only', 'true');
    if (page > 1) params.set('page', String(page));
    const next = params.toString();
    const current = searchParams.toString();
    if (next !== current) {
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
    }
    // Outward URL sync only — don't re-run when searchParams echo our replace.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [q, type, country, peOnly, page, pathname, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listEntities({
        q: q || undefined,
        type: type || undefined,
        country: country || undefined,
        pe_only: peOnly || undefined,
        page,
        limit,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [q, type, country, peOnly, page]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div>
          <label htmlFor={searchId} className="sr-only">
            Search by name
          </label>
          <input
            id={searchId}
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-lg border border-fupe-border bg-fupe-elevated px-4 py-2.5 text-fupe-text outline-none placeholder:text-fupe-accentDim focus:border-fupe-muted"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor={typeId} className="sr-only">
              Entity type
            </label>
            <select
              id={typeId}
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-fupe-border bg-fupe-elevated px-3 py-2 text-sm text-fupe-text outline-none focus:border-fupe-muted"
            >
              {ENTITY_TYPES.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={countryId} className="sr-only">
              Country
            </label>
            <select
              id={countryId}
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-fupe-border bg-fupe-elevated px-3 py-2 text-sm text-fupe-text outline-none focus:border-fupe-muted"
            >
              {COUNTRIES.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm text-fupe-muted">
            <input
              type="checkbox"
              checked={peOnly}
              onChange={(e) => {
                setPeOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded border-fupe-border"
            />
            PE-backed only
          </label>
        </div>
      </div>

      {loading && (
        <p className="text-center text-fupe-muted" aria-live="polite">
          Loading directory…
        </p>
      )}

      {error && (
        <p className="text-center text-status-error" role="alert">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <p className="text-sm text-fupe-muted" aria-live="polite">
            {total} {total === 1 ? 'entity' : 'entities'}
          </p>

          <ul className="divide-y divide-fupe-border rounded-xl border border-fupe-border bg-fupe-surface">
            {items.map((entity) => (
              <li
                key={entity.id}
                className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-fupe-elevated"
              >
                <Link href={entityPath(entity.slug)} className="min-w-0 flex-1">
                  <p className="font-medium text-fupe-text">{entity.name}</p>
                  <p className="text-xs text-fupe-muted">
                    {entity.type.replace(/_/g, ' ')}
                    {entity.sector ? ` · ${entity.sector}` : ''}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  {entity.is_pe_backed ? (
                    <span className="text-xs font-semibold uppercase tracking-wider text-verdict-yes">
                      PE
                    </span>
                  ) : (
                    <span className="text-xs text-fupe-accentDim">—</span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {items.length === 0 && (
            <p className="text-center text-fupe-muted">No entities match.</p>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-fupe-border px-4 py-2 text-sm text-fupe-text disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-fupe-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-fupe-border px-4 py-2 text-sm text-fupe-text disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
