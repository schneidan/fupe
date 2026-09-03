'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchAdminAudit,
  fetchAdminSubscriptions,
  fetchAdminUsers,
  fetchBillingHealth,
  overrideTier,
  type AdminAuditEntry,
  type AdminSubscriber,
  type BillingHealth,
} from '@/lib/admin-api';

const TIERS = ['free', 'developer', 'business'] as const;

function stripeCustomerUrl(customerId: string, mode: BillingHealth['stripe_mode']) {
  const prefix = mode === 'live' ? '' : 'test/';
  return `https://dashboard.stripe.com/${prefix}customers/${customerId}`;
}

function formatPeriodEnd(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function HealthBanner({ health }: { health: BillingHealth }) {
  let tone = 'border-fupe-border text-fupe-muted';
  let title = 'Stripe webhooks';
  let detail: string;

  if (!health.stripe_configured) {
    tone = 'border-fupe-border bg-fupe-elevated text-fupe-muted';
    title = 'Stripe not configured';
    detail = 'Set STRIPE_SECRET_KEY and STRIPE_PRICE_DEVELOPER to enable billing.';
  } else if (!health.webhook_secret_set) {
    tone = 'border-verdict-yes/40 bg-verdict-yes/5 text-verdict-yes';
    title = 'Webhook secret missing';
    detail = 'STRIPE_WEBHOOK_SECRET is unset — events will not sync.';
  } else if (health.stale) {
    tone = 'border-verdict-yes/40 bg-verdict-yes/5 text-verdict-yes';
    title = 'Webhook sync stale';
    detail = health.last_event_at
      ? `Last event ${health.last_event_type} at ${new Date(health.last_event_at).toLocaleString()}.`
      : 'No webhook events received yet. Run `stripe listen --forward-to localhost:3000/api/v1/billing/webhook`.';
  } else {
    tone = 'border-fupe-border bg-fupe-elevated text-fupe-text';
    title = 'Webhooks healthy';
    detail = `Last: ${health.last_event_type} · ${new Date(health.last_event_at!).toLocaleString()} · ${health.events_last_7d} events in 7d`;
  }

  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 opacity-90">{detail}</p>
    </div>
  );
}

export function AdminSubscriptionsPanel() {
  const [items, setItems] = useState<AdminSubscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [compEmail, setCompEmail] = useState('');
  const [compTier, setCompTier] = useState<'developer' | 'business'>('developer');
  const [health, setHealth] = useState<BillingHealth | null>(null);
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [res, h, a] = await Promise.all([
        fetchAdminSubscriptions({ page }),
        fetchBillingHealth(),
        fetchAdminAudit({ action: 'tier_override', limit: 15 }),
      ]);
      setItems(res.subscribers);
      setTotal(res.total);
      setHealth(h);
      setAudit(a.entries);
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
      await overrideTier(userId, tier, note.trim() || undefined);
      setNote('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Override failed');
    } finally {
      setBusy(null);
    }
  }

  async function grantComplimentary() {
    const email = compEmail.trim().toLowerCase();
    if (!email) {
      setError('Enter the user email to grant a complimentary tier');
      return;
    }
    setBusy('comp');
    setError(null);
    try {
      const res = await fetchAdminUsers({ q: email });
      const match =
        res.users.find((u) => u.email.toLowerCase() === email) ?? res.users[0];
      if (!match) throw new Error('No user with that email');
      await overrideTier(match.id, compTier, note.trim() || undefined);
      setNote('');
      setCompEmail('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Complimentary grant failed');
    } finally {
      setBusy(null);
    }
  }

  const LIMIT = 50;
  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const mode = health?.stripe_mode ?? 'test';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fupe-text">Subscriptions</h1>
        <p className="mt-1 text-sm text-fupe-muted">
          {total} subscriber records ·{' '}
          <a
            href={health?.dashboard_url ?? 'https://dashboard.stripe.com/test/subscriptions'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-fupe-text hover:underline"
          >
            Open Stripe Dashboard ↗
          </a>
        </p>
      </div>

      {health && <HealthBanner health={health} />}

      {error && <p className="text-sm text-verdict-yes">{error}</p>}

      <div className="space-y-3 rounded-xl border border-fupe-border p-4">
        <p className="text-sm font-semibold text-fupe-text">Complimentary upgrade</p>
        <p className="text-xs text-fupe-muted">
          Grants Developer/Business without Stripe. Status becomes admin_override and
          later Stripe events will not overwrite it (a new checkout still will).
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm text-fupe-muted">
            Email
            <input
              type="email"
              value={compEmail}
              onChange={(e) => setCompEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-1 block w-56 rounded border border-fupe-border bg-fupe-bg px-3 py-1.5 text-sm text-fupe-text"
            />
          </label>
          <label className="text-sm text-fupe-muted">
            Tier
            <select
              value={compTier}
              onChange={(e) => setCompTier(e.target.value as 'developer' | 'business')}
              className="mt-1 block rounded border border-fupe-border bg-fupe-bg px-2 py-1.5 text-sm text-fupe-text"
            >
              <option value="developer">developer</option>
              <option value="business">business</option>
            </select>
          </label>
          <label className="min-w-[12rem] flex-1 text-sm text-fupe-muted">
            Note
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              placeholder="e.g. partner comp through Q4"
              className="mt-1 block w-full rounded border border-fupe-border bg-fupe-bg px-3 py-1.5 text-sm text-fupe-text"
            />
          </label>
          <button
            type="button"
            disabled={busy === 'comp'}
            onClick={() => void grantComplimentary()}
            className="rounded border border-fupe-border px-3 py-1.5 text-sm text-fupe-text hover:bg-fupe-elevated disabled:opacity-40"
          >
            Grant
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-fupe-border">
        <table className="w-full text-sm">
          <thead className="border-b border-fupe-border bg-fupe-elevated text-xs font-semibold uppercase tracking-wider text-fupe-muted">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Period end</th>
              <th className="px-4 py-3 text-left">Stripe customer</th>
              <th className="px-4 py-3 text-left">Override</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fupe-border">
            {loading && !items.length ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-fupe-muted">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-fupe-muted">No subscribers yet.</td></tr>
            ) : items.map((s) => (
              <tr key={s.id} className="hover:bg-fupe-elevated/40">
                <td className="px-4 py-3 font-mono text-xs text-fupe-text">{s.email}</td>
                <td className="px-4 py-3 text-fupe-text">{s.subscription_tier}</td>
                <td className="px-4 py-3 text-fupe-muted">{s.subscription_status ?? '—'}</td>
                <td className="px-4 py-3 text-xs text-fupe-muted">
                  {formatPeriodEnd(s.subscription_current_period_end)}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-fupe-muted">
                  {s.stripe_customer_id ? (
                    <a
                      href={stripeCustomerUrl(s.stripe_customer_id, mode)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-fupe-text hover:underline"
                    >
                      {s.stripe_customer_id.slice(0, 16)}…
                    </a>
                  ) : '—'}
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

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fupe-muted">
          Recent tier overrides
        </h2>
        <p className="mt-1 text-xs text-fupe-muted">
          Full log at{' '}
          <a href="/admin/audit" className="text-fupe-text hover:underline">
            Audit
          </a>
          .
        </p>
        {audit.length === 0 ? (
          <p className="mt-2 text-sm text-fupe-muted">None yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-fupe-border rounded-xl border border-fupe-border text-sm">
            {audit.map((e) => (
              <li key={e.id} className="px-4 py-2.5">
                <p className="text-fupe-text">
                  <span className="font-mono text-xs">{e.actor_email ?? 'unknown'}</span>
                  {' '}
                  {String(e.previous_state?.subscription_tier ?? '?')} → {String(e.new_state?.subscription_tier ?? '?')}
                </p>
                <p className="text-xs text-fupe-muted">
                  {new Date(e.created_at).toLocaleString()}
                  {e.note ? ` · ${e.note}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
