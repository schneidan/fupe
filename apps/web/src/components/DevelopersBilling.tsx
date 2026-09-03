'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  fetchMe,
  getStoredUser,
  getToken,
  type AuthUser,
} from '@/lib/auth';

interface BillingStatus {
  subscription_tier: string;
  subscription_status: string | null;
  stripe_configured: boolean;
  tiers: Record<
    string,
    {
      price_usd: number | null;
      rate_limit_daily: number;
      image_lookup: boolean;
      note?: string;
    }
  >;
}

async function authJson<T>(path: string, init: RequestInit & { token: string }) {
  const { token, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(rest.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (body as { message?: string | string[] }).message ?? 'Request failed';
    throw new Error(Array.isArray(msg) ? msg.join(', ') : String(msg));
  }
  return body as T;
}

export function DevelopersBilling() {
  const searchParams = useSearchParams();
  const checkout = searchParams.get('checkout');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);

  useEffect(() => {
    void fetchMe().then((me) => setUser(me ?? getStoredUser()));
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    authJson<BillingStatus>('/api/v1/billing/status', { method: 'GET', token })
      .then(setStatus)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load billing'),
      );
  }, [user?.id, checkout]);

  async function startCheckout(tier: 'developer' | 'business' = 'developer') {
    const token = getToken();
    if (!token) {
      window.location.href = '/login?next=/developers';
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { url } = await authJson<{ url: string }>('/api/v1/billing/checkout', {
        method: 'POST',
        token,
        body: JSON.stringify({ tier }),
      });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed');
      setBusy(false);
    }
  }

  async function openPortal() {
    const token = getToken();
    if (!token) return;
    setBusy(true);
    try {
      const { url } = await authJson<{ url: string }>('/api/v1/billing/portal', {
        method: 'POST',
        token,
      });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Portal failed');
      setBusy(false);
    }
  }

  async function createKey() {
    const token = getToken();
    if (!token) {
      window.location.href = '/login?next=/developers';
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authJson<{ secret: string }>('/api/v1/api-keys', {
        method: 'POST',
        token,
        body: JSON.stringify({ name: 'Default' }),
      });
      setNewKeySecret(res.secret);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create key');
    } finally {
      setBusy(false);
    }
  }

  const tier = status?.subscription_tier ?? 'free';

  return (
    <div className="mt-10 space-y-10">
      {checkout === 'success' ? (
        <p className="rounded-lg border border-fupe-border bg-fupe-surface px-4 py-3 text-sm text-fupe-text">
          Payment received — your keys will move to the paid tier once Stripe
          confirms (usually a few seconds). Refresh if needed.
        </p>
      ) : null}
      {checkout === 'cancel' ? (
        <p className="text-sm text-fupe-muted">Checkout canceled.</p>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ['free', 'Free'],
            ['developer', 'Developer'],
            ['business', 'Business'],
          ] as const
        ).map(([id, label]) => {
          const t = status?.tiers?.[id];
          const active = tier === id;
          return (
            <div
              key={id}
              className={`rounded-xl border p-5 ${
                active
                  ? 'border-fupe-text bg-fupe-surface'
                  : 'border-fupe-border bg-fupe-surface/60'
              }`}
            >
              <h2 className="font-semibold text-fupe-text">{label}</h2>
              <p className="mt-2 text-2xl text-fupe-text">
                {t?.price_usd == null
                  ? 'Custom'
                  : t.price_usd === 0
                    ? '$0'
                    : `$${t.price_usd}/mo`}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-fupe-muted">
                <li>{t?.rate_limit_daily?.toLocaleString() ?? '—'} req/day</li>
                <li>
                  {t?.image_lookup ? 'IMAGE lookup included' : 'No IMAGE lookup'}
                </li>
                {t?.note ? <li>{t.note}</li> : null}
              </ul>
              {id === 'developer' && tier === 'free' ? (
                <button
                  type="button"
                  disabled={busy || status?.stripe_configured === false}
                  onClick={() => startCheckout('developer')}
                  className="mt-4 w-full rounded-full bg-fupe-text px-4 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-50"
                >
                  {status?.stripe_configured === false
                    ? 'Stripe not configured'
                    : 'Upgrade'}
                </button>
              ) : null}
              {id === 'business' && tier !== 'business' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => startCheckout('business')}
                  className="mt-4 w-full rounded-full border border-fupe-border px-4 py-2 text-sm text-fupe-text hover:border-fupe-muted disabled:opacity-50"
                >
                  Upgrade (if priced)
                </button>
              ) : null}
              {active ? (
                <p className="mt-3 text-xs uppercase tracking-wider text-fupe-muted">
                  Current plan
                </p>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="rounded-xl border border-fupe-border bg-fupe-surface p-6 space-y-4">
        <h2 className="font-semibold text-fupe-text">API keys</h2>
        {!user ? (
          <p className="text-sm text-fupe-muted">
            <Link href="/login?next=/developers" className="text-fupe-text hover:underline">
              Sign in
            </Link>{' '}
            to create a key and manage billing.
          </p>
        ) : (
          <>
            <p className="text-sm text-fupe-muted">
              Signed in as {user.email}. Tier:{' '}
              <span className="text-fupe-text">{tier}</span>
              {status?.subscription_status
                ? ` (${status.subscription_status})`
                : ''}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void createKey()}
                className="rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-60"
              >
                Create API key
              </button>
              {tier !== 'free' ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void openPortal()}
                  className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text hover:border-fupe-muted disabled:opacity-60"
                >
                  Manage subscription
                </button>
              ) : null}
            </div>
            {newKeySecret ? (
              <div className="rounded-lg border border-fupe-border bg-fupe-bg p-3">
                <p className="text-xs text-fupe-muted">
                  Copy now — it won&apos;t be shown again.
                </p>
                <code className="mt-1 block break-all text-sm text-fupe-text">
                  {newKeySecret}
                </code>
              </div>
            ) : null}
          </>
        )}
        {error ? <p className="text-sm text-verdict-yes">{error}</p> : null}
      </section>

      <section className="text-sm text-fupe-muted space-y-2">
        <h2 className="font-semibold text-fupe-text">Quick start</h2>
        <pre className="overflow-x-auto rounded-lg border border-fupe-border bg-fupe-bg p-4 text-xs text-fupe-text">{`curl -H "X-API-Key: fupe_…" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"TEXT","query":"Panera"}' \\
  ${typeof window !== 'undefined' ? window.location.origin.replace('3001', '3000') : 'http://localhost:3000'}/api/v1/lookup`}</pre>
      </section>
    </div>
  );
}
