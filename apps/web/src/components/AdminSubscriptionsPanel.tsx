'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchAdminSubscriptions,
  overrideTier,
  type AdminSubscriber,
} from '@/lib/admin-api';

const TIERS = ['free', 'developer', 'business'] as const;

export function AdminSubscriptionsPanel() {
  const [items, setItems] = useState<AdminSubscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminSubscriptions({ page });
      setItems(res.subscribers);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function setTier(userId: string, tier: 'free' | 'developer' | 'business') {
    setBusy(userId);
    try {
      await overrideTier(userId, tier);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Override failed');
    } finally {
      setBusy(null);
    }
  }

  const LIMIT = 50;
  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fupe-text">Subscriptions</h1>
        <p className="mt-1 text-sm text-fupe-muted">
          {total} subscriber records ·{' '}
          <a
            href="https://dashboard.stripe.com/test/subscriptions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-fupe-text hover:underline"
          >
            Open Stripe Dashboard ↗
          </a>
        </p>
      </div>

      {error && <p className="text-sm text-verdict-yes">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-fupe-border">
        <table className="w-full text-sm">
          <thead className="border-b border-fupe-border bg-fupe-elevated text-xs font-semibold uppercase tracking-wider text-fupe-muted">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Stripe customer</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-left">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fupe-border">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-fupe-muted">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-fupe-muted">No subscribers yet.</td></tr>
            ) : items.map((s) => (
              <tr key={s.id} className="hover:bg-fupe-elevated/40">
                <td className="px-4 py-3 font-mono text-xs text-fupe-text">{s.email}</td>
                <td className="px-4 py-3 text-fupe-text">{s.subscription_tier}</td>
                <td className="px-4 py-3 text-fupe-muted">{s.subscription_status ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-xs text-fupe-muted">
                  {s.stripe_customer_id ? (
                    <a
                      href={`https://dashboard.stripe.com/test/customers/${s.stripe_customer_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-fupe-text hover:underline"
                    >
                      {s.stripe_customer_id.slice(0, 16)}…
                    </a>
                  ) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-fupe-muted">
                  {new Date(s.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={s.subscription_tier}
                    disabled={busy === s.id}
                    onChange={(e) => setTier(s.id, e.target.value as 'free' | 'developer' | 'business')}
                    className="rounded border border-fupe-border bg-fupe-bg px-1.5 py-0.5 text-xs text-fupe-text"
                  >
                    {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm text-fupe-muted">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded border border-fupe-border px-3 py-1 hover:text-fupe-text disabled:opacity-40">←</button>
          <span>Page {page} of {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="rounded border border-fupe-border px-3 py-1 hover:text-fupe-text disabled:opacity-40">→</button>
        </div>
      )}
    </div>
  );
}
