'use client';

import { useEffect, useState, useCallback } from 'react';
import { fetchUsageSummary, type AdminKeyUsage } from '@/lib/admin-api';

export function AdminUsagePanel() {
  const [usage, setUsage] = useState<AdminKeyUsage[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchUsageSummary({ page });
      setUsage(res.usage);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fupe-text">API usage</h1>
        <p className="mt-1 text-sm text-fupe-muted">Today's requests per active key.</p>
      </div>

      {error && <p className="text-sm text-verdict-yes">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-fupe-border">
        <table className="w-full text-sm">
          <thead className="border-b border-fupe-border bg-fupe-elevated text-xs font-semibold uppercase tracking-wider text-fupe-muted">
            <tr>
              <th className="px-4 py-3 text-left">Key prefix</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Owner</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-right">Requests today</th>
              <th className="px-4 py-3 text-right">Blocked (403)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fupe-border">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-fupe-muted">Loading…</td></tr>
            ) : usage.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-fupe-muted">No API keys active yet.</td></tr>
            ) : usage.map((row) => (
              <tr key={row.id} className="hover:bg-fupe-elevated/40">
                <td className="px-4 py-3 font-mono text-xs text-fupe-muted">{row.key_prefix}…</td>
                <td className="px-4 py-3 text-fupe-text">{row.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-fupe-muted">{row.email}</td>
                <td className="px-4 py-3 text-fupe-muted">{row.tier}</td>
                <td className="px-4 py-3 text-right font-semibold text-fupe-text">{row.requests_today}</td>
                <td className="px-4 py-3 text-right text-verdict-yes">{row.blocked_today || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3 text-sm text-fupe-muted">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || loading} className="rounded border border-fupe-border px-3 py-1 hover:text-fupe-text disabled:opacity-40">←</button>
        <span>Page {page}</span>
        <button onClick={() => { setPage((p) => p + 1); }} disabled={loading || usage.length < 50} className="rounded border border-fupe-border px-3 py-1 hover:text-fupe-text disabled:opacity-40">→</button>
      </div>
    </div>
  );
}
