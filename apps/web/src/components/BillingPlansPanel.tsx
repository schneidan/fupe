'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  fetchMe,
  getStoredUser,
  getToken,
  type AuthUser,
} from '@/lib/auth';

export interface TierInfo {
  price_usd: number | null;
  rate_limit_daily: number;
  image_lookup: boolean;
  note?: string;
}

export interface BillingStatus {
  subscription_tier: string;
  subscription_status: string | null;
  current_period_end?: string | null;
  stripe_configured: boolean;
  prices_configured?: {
    developer?: boolean;
    pro?: boolean;
  };
  tiers: Record<string, TierInfo>;
}

/** Keep in sync with API TIER_* constants. */
export const FALLBACK_TIERS: Record<string, TierInfo> = {
  free: { price_usd: 0, rate_limit_daily: 100, image_lookup: false },
  developer: { price_usd: 9, rate_limit_daily: 10_000, image_lookup: true },
  pro: { price_usd: 29, rate_limit_daily: 50_000, image_lookup: true },
};

const TIER_RANK: Record<string, number> = {
  free: 0,
  developer: 1,
  pro: 2,
};

type PaidPlan = 'developer' | 'pro';
type ReturnTo = '/developers' | '/account';

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

function isPaidStatus(status: string | null | undefined): boolean {
  const s = (status ?? '').toLowerCase();
  return (
    s === 'active' ||
    s === 'trialing' ||
    s === 'past_due' ||
    s === 'admin_override'
  );
}

function planActionLabel(
  currentTier: string,
  target: PaidPlan,
  status: BillingStatus | null,
): string {
  if (!status) return 'Subscribe now!';
  if (status.stripe_configured === false) return 'Currently unavailable';
  if (target === 'developer' && status.prices_configured?.developer === false) {
    return 'Currently unavailable';
  }
  if (target === 'pro' && status.prices_configured?.pro !== true) {
    return 'Currently unavailable';
  }

  const current = currentTier || 'free';
  const paid = isPaidStatus(status.subscription_status) && current !== 'free';
  if (!paid) return 'Subscribe now!';

  const from = TIER_RANK[current] ?? 0;
  const to = TIER_RANK[target] ?? 0;
  if (to > from) return 'Upgrade now!';
  if (to < from) return 'Downgrade now!';
  return 'Subscribe now!';
}

export function BillingPlansPanel({
  returnTo,
  showAdminHint = false,
  compact = false,
}: {
  returnTo: ReturnTo;
  showAdminHint?: boolean;
  /** Account page: shorter intro, no API-keys block. */
  compact?: boolean;
}) {
  const searchParams = useSearchParams();
  const [checkoutFlash, setCheckoutFlash] = useState<string | null>(null);
  const [switchFlash, setSwitchFlash] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loginNext = returnTo;

  const reloadStatus = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setStatus(null);
      return;
    }
    try {
      const s = await authJson<BillingStatus>('/api/v1/billing/status', {
        method: 'GET',
        token,
      });
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load billing');
    }
  }, []);

  useEffect(() => {
    const c = searchParams.get('checkout');
    if (c === 'success' || c === 'cancel') {
      setCheckoutFlash(c);
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      window.history.replaceState(
        {},
        '',
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
  }, [searchParams]);

  useEffect(() => {
    void fetchMe().then((me) => setUser(me ?? getStoredUser()));
  }, []);

  useEffect(() => {
    void reloadStatus();
  }, [user?.id, checkoutFlash, reloadStatus]);

  async function startPlanChange(tier: PaidPlan) {
    const token = getToken();
    if (!token) {
      window.location.href = `/login?next=${encodeURIComponent(loginNext)}`;
      return;
    }
    setBusy(true);
    setError(null);
    setSwitchFlash(null);
    try {
      const res = await authJson<
        | { mode: 'checkout'; url: string }
        | ({ mode: 'switched' } & BillingStatus)
        // Legacy: older API returned only { url }
        | { url: string; mode?: undefined }
      >('/api/v1/billing/checkout', {
        method: 'POST',
        token,
        body: JSON.stringify({ tier, return_to: returnTo }),
      });

      if (res.mode === 'switched') {
        setStatus(res);
        setSwitchFlash(
          tier === 'pro'
            ? 'You’re on Pro now. Limits update immediately; Stripe prorates the change.'
            : 'You’re on Developer now. Limits update immediately; Stripe prorates the change.',
        );
        void fetchMe().then((me) => {
          if (me) setUser(me);
        });
        setBusy(false);
        return;
      }

      const url = res.url;
      if (!url) throw new Error('No checkout URL returned');
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
        body: JSON.stringify({ return_to: returnTo }),
      });
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Portal failed');
      setBusy(false);
    }
  }

  const tier = status?.subscription_tier ?? user?.subscription_tier ?? 'free';
  const subStatus =
    status?.subscription_status ?? user?.subscription_status ?? null;
  const paidActive =
    checkoutFlash === 'success' &&
    (tier === 'developer' || tier === 'pro') &&
    isPaidStatus(subStatus);

  const developerReady =
    status?.stripe_configured !== false &&
    status?.prices_configured?.developer !== false;
  const proReady =
    status?.stripe_configured !== false &&
    status?.prices_configured?.pro === true;

  function planDisabled(plan: PaidPlan) {
    if (busy) return true;
    if (!status) return false;
    if (status.stripe_configured === false) return true;
    if (plan === 'developer') return status.prices_configured?.developer === false;
    return status.prices_configured?.pro !== true;
  }

  return (
    <div className={compact ? 'space-y-4' : 'space-y-10'}>
      {switchFlash ? (
        <section className="rounded-xl border border-fupe-text/40 bg-fupe-surface px-5 py-4 space-y-2">
          <p className="text-sm text-fupe-text">{switchFlash}</p>
          <button
            type="button"
            onClick={() => setSwitchFlash(null)}
            className="text-sm text-fupe-muted hover:text-fupe-text"
          >
            Dismiss
          </button>
        </section>
      ) : null}

      {checkoutFlash === 'success' ? (
        <section className="rounded-xl border border-fupe-text/40 bg-fupe-surface px-5 py-5 space-y-3">
          <h2 className="text-lg font-semibold text-fupe-text">
            {paidActive ? 'You’re on a paid plan' : 'Payment received'}
          </h2>
          <p className="text-sm text-fupe-muted">
            {paidActive
              ? `Your account is on the ${tier} tier.`
              : 'Stripe is confirming your subscription — usually a few seconds. Refresh if the tier hasn’t updated.'}
          </p>
          <button
            type="button"
            onClick={() => setCheckoutFlash(null)}
            className="text-sm text-fupe-muted hover:text-fupe-text"
          >
            Dismiss
          </button>
        </section>
      ) : null}

      {checkoutFlash === 'cancel' ? (
        <section className="rounded-xl border border-fupe-border bg-fupe-surface px-5 py-5 space-y-3">
          <h2 className="text-lg font-semibold text-fupe-text">
            Checkout canceled
          </h2>
          <p className="text-sm text-fupe-muted">
            No charge was made. You can stay on Free or subscribe whenever you’re
            ready.
          </p>
          <button
            type="button"
            onClick={() => setCheckoutFlash(null)}
            className="text-sm text-fupe-muted hover:text-fupe-text"
          >
            Dismiss
          </button>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        {(
          [
            ['free', 'Free'],
            ['developer', 'Developer'],
            ['pro', 'Pro'],
          ] as const
        ).map(([id, label]) => {
          const t = status?.tiers?.[id] ?? FALLBACK_TIERS[id];
          const active = tier === id;
          const showDevBtn = id === 'developer' && tier !== 'developer';
          const showProBtn = id === 'pro' && tier !== 'pro';
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
                  ? '—'
                  : t.price_usd === 0
                    ? '$0'
                    : `$${t.price_usd}/mo`}
              </p>
              <ul className="mt-3 space-y-1 text-sm text-fupe-muted">
                <li>{t?.rate_limit_daily?.toLocaleString() ?? '—'} req/day</li>
                <li>
                  {t?.image_lookup ? 'Image lookup included' : 'No image lookup'}
                </li>
                {t?.note ? <li>{t.note}</li> : null}
              </ul>
              {showDevBtn ? (
                <button
                  type="button"
                  disabled={planDisabled('developer')}
                  onClick={() => void startPlanChange('developer')}
                  className="mt-4 w-full rounded-full border border-fupe-border px-4 py-2 text-sm font-semibold text-fupe-text hover:border-fupe-muted disabled:opacity-50"
                >
                  {planActionLabel(tier, 'developer', status)}
                </button>
              ) : null}
              {showProBtn ? (
                <button
                  type="button"
                  disabled={planDisabled('pro')}
                  onClick={() => void startPlanChange('pro')}
                  className={`mt-4 w-full rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                    tier === 'developer'
                      ? 'bg-fupe-text text-fupe-bg hover:bg-fupe-muted'
                      : 'border border-fupe-border text-fupe-text hover:border-fupe-muted'
                  }`}
                >
                  {planActionLabel(tier, 'pro', status)}
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

      {showAdminHint &&
      user?.role === 'admin' &&
      (!developerReady || !proReady) ? (
        <p className="text-xs text-fupe-muted">
          Stripe products: set{' '}
          <code className="text-fupe-text">STRIPE_PRICE_DEVELOPER</code>
          {!proReady ? (
            <>
              {' '}
              and <code className="text-fupe-text">STRIPE_PRICE_PRO</code>
            </>
          ) : null}{' '}
          on the API to enable checkout.
        </p>
      ) : null}

      {user && tier !== 'free' ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => void openPortal()}
            className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text hover:border-fupe-muted disabled:opacity-60"
          >
            Manage subscription
          </button>
          {compact ? (
            <Link
              href="/developers"
              className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text hover:border-fupe-muted"
            >
              API keys &amp; docs
            </Link>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-sm text-status-error">{error}</p> : null}
    </div>
  );
}
