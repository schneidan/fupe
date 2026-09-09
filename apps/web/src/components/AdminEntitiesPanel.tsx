'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  bulkDeleteAdminEntities,
  fetchAdminEntities,
  type AdminEntityListItem,
} from '@/lib/admin-api';
import { entityPath } from '@/lib/slug';

const LETTERS = [
  'All',
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),
  '#',
] as const;
const PAGE_SIZE = 50;

export function AdminEntitiesPanel() {
  const [items, setItems] = useState<AdminEntityListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [letter, setLetter] = useState<string>('All');
  const [prefixDraft, setPrefixDraft] = useState('');
  const [prefix, setPrefix] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Typeahead: debounce prefix draft → committed prefix
  useEffect(() => {
    const t = window.setTimeout(() => {
      setPrefix(prefixDraft.trim());
      setPage(1);
    }, 200);
    return () => window.clearTimeout(t);
  }, [prefixDraft]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminEntities({
        prefix: prefix || undefined,
        letter: letter === 'All' ? undefined : letter,
        page,
        limit: PAGE_SIZE,
      });
      setItems(res.items);
      setTotal(res.total);
      setSelected((prev) => {
        const next = new Set<string>();
        for (const id of prev) {
          if (res.items.some((i) => i.id === id)) next.add(id);
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load entities');
    } finally {
      setLoading(false);
    }
  }, [prefix, letter, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const allOnPageSelected = useMemo(
    () => items.length > 0 && items.every((i) => selected.has(i.id)),
    [items, selected],
  );

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        for (const i of items) next.delete(i.id);
      } else {
        for (const i of items) next.add(i.id);
      }
      return next;
    });
  }

  async function onBulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    const ok = window.confirm(
      `Delete ${ids.length} entit${ids.length === 1 ? 'y' : 'ies'} individually? Each is blocklisted. Ownership chains are not cascaded.`,
    );
    if (!ok) return;
    setDeleting(true);
    setError(null);
    setStatus(null);
    try {
      const res = await bulkDeleteAdminEntities(ids);
      setStatus(
        `Deleted ${res.count} entit${res.count === 1 ? 'y' : 'ies'}${
          res.missing.length ? ` (${res.missing.length} missing)` : ''
        }.`,
      );
      setSelected(new Set());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Bulk delete failed');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-fupe-text">Entities</h1>
          <p className="mt-1 text-sm text-fupe-muted">
            {total} matching · bulk delete removes individual nodes only (no
            ownership-chain cascade). Deleted names are blocklisted.
          </p>
        </div>
        <button
          type="button"
          disabled={deleting || selected.size === 0}
          onClick={() => void onBulkDelete()}
          className="rounded-lg border border-verdict-yes px-4 py-2 text-sm font-semibold text-verdict-yes hover:bg-verdict-yes/10 disabled:opacity-40"
        >
          {deleting
            ? 'Deleting…'
            : `Delete selected (${selected.size})`}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {LETTERS.map((L) => {
          const active = letter === L;
          return (
            <button
              key={L}
              type="button"
              onClick={() => {
                setLetter(L);
                setPage(1);
              }}
              className={`min-w-[1.75rem] rounded px-2 py-1 text-xs font-medium ${
                active
                  ? 'bg-fupe-text text-fupe-bg'
                  : 'text-fupe-muted hover:bg-fupe-elevated hover:text-fupe-text'
              }`}
            >
              {L}
            </button>
          );
        })}
      </div>

      <label className="block max-w-md text-sm">
        <span className="text-fupe-muted">Search (prefix)</span>
        <input
          value={prefixDraft}
          onChange={(e) => setPrefixDraft(e.target.value)}
          placeholder="Type to filter — S, then ST…"
          className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-elevated px-3 py-2 text-fupe-text outline-none placeholder:text-fupe-accentDim focus:border-fupe-muted"
        />
      </label>

      {error && (
        <p className="text-sm text-status-error" role="alert">
          {error}
        </p>
      )}
      {status && <p className="text-sm text-verdict-no">{status}</p>}

      <div className="overflow-x-auto rounded-lg border border-fupe-border">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-fupe-border bg-fupe-elevated text-xs uppercase tracking-wide text-fupe-muted">
            <tr>
              <th className="px-3 py-2 w-10">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={togglePage}
                  aria-label="Select all on page"
                />
              </th>
              <th className="px-3 py-2">Entity</th>
              <th className="px-3 py-2">Type</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-fupe-muted">
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-8 text-fupe-muted">
                  No entities match.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-fupe-border/60 hover:bg-fupe-elevated/50"
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleOne(item.id)}
                      aria-label={`Select ${item.name}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={entityPath(item.slug || item.id)}
                      className="font-medium text-fupe-text hover:underline"
                    >
                      {item.name}
                    </Link>
                    <span className="ml-2 text-fupe-muted">
                      ({item.children_count} children, {item.parents_count}{' '}
                      parents)
                    </span>
                  </td>
                  <td className="px-3 py-2 text-fupe-muted">{item.type}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4 text-sm text-fupe-muted">
        <span>
          Page {page} of {pages}
          {loading ? ' · refreshing…' : ''}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded border border-fupe-border px-3 py-1.5 hover:border-fupe-muted disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= pages || loading}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-fupe-border px-3 py-1.5 hover:border-fupe-muted disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
