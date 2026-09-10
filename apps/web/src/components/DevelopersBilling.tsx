'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import {
  fetchMe,
  getStoredUser,
  getToken,
  type AuthUser,
} from '@/lib/auth';
import { BillingPlansPanel } from '@/components/BillingPlansPanel';

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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newKeySecret, setNewKeySecret] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    void fetchMe().then((me) => setUser(me ?? getStoredUser()));
    window.addEventListener('fupe-auth', sync);
    return () => window.removeEventListener('fupe-auth', sync);
  }, []);

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
      void fetchMe().then((me) => {
        if (me) setUser(me);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create key');
    } finally {
      setBusy(false);
    }
  }

  const tier = user?.subscription_tier ?? 'free';

  return (
    <div className="mt-10 space-y-10">
      <Suspense fallback={<p className="text-fupe-muted">Loading plans…</p>}>
        <BillingPlansPanel returnTo="/developers" showAdminHint />
      </Suspense>

      <section
        id="api-keys"
        className="rounded-xl border border-fupe-border bg-fupe-surface p-6 space-y-4"
      >
        <h2 className="font-semibold text-fupe-text">API keys</h2>
        {!user ? (
          <p className="text-sm text-fupe-muted">
            <Link
              href="/login?next=/developers"
              className="text-fupe-text hover:underline"
            >
              Sign in
            </Link>{' '}
            to create a key and manage billing.
          </p>
        ) : (
          <>
            <p className="text-sm text-fupe-muted">
              Signed in as {user.email}. Tier:{' '}
              <span className="text-fupe-text">{tier}</span>
              {user.subscription_status
                ? ` (${user.subscription_status})`
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
        {error ? <p className="text-sm text-status-error">{error}</p> : null}
      </section>
    </div>
  );
}
