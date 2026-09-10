'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

type Preview = {
  email_masked: string;
  already_unsubscribed: boolean;
};

function UnsubscribeInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing unsubscribe token. Use the link from your email.');
      return;
    }
    let cancelled = false;
    void fetch(
      `/api/v1/auth/email-updates/unsubscribe?token=${encodeURIComponent(token)}`,
    )
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string | string[];
          email_masked?: string;
          already_unsubscribed?: boolean;
        };
        if (!res.ok) {
          const msg = Array.isArray(body.message)
            ? body.message.join(', ')
            : body.message;
          throw new Error(msg || 'Invalid or expired link');
        }
        if (!cancelled) {
          setPreview({
            email_masked: body.email_masked ?? 'your address',
            already_unsubscribed: Boolean(body.already_unsubscribed),
          });
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load link');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function confirm() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/auth/email-updates/unsubscribe?token=${encodeURIComponent(token)}`,
        { method: 'POST' },
      );
      const body = (await res.json().catch(() => ({}))) as {
        message?: string | string[];
      };
      if (!res.ok) {
        const msg = Array.isArray(body.message)
          ? body.message.join(', ')
          : body.message;
        throw new Error(msg || 'Unsubscribe failed');
      }
      setDone(
        typeof body.message === 'string'
          ? body.message
          : 'You are unsubscribed from product updates.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unsubscribe failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-10 space-y-4 text-center">
      {error ? (
        <p className="text-sm text-status-error" role="alert">
          {error}
        </p>
      ) : null}

      {done ? (
        <>
          <p className="text-fupe-text">{done}</p>
          <p className="text-sm text-fupe-muted">
            You can re-enable updates anytime on your{' '}
            <Link href="/account" className="text-fupe-text hover:underline">
              account
            </Link>{' '}
            page.
          </p>
        </>
      ) : preview?.already_unsubscribed ? (
        <>
          <p className="text-fupe-text">
            {preview.email_masked} is already unsubscribed from product updates.
          </p>
          <Link
            href="/account"
            className="inline-block text-sm text-fupe-muted hover:text-fupe-text"
          >
            Manage account preferences
          </Link>
        </>
      ) : preview ? (
        <>
          <p className="text-fupe-muted">
            Unsubscribe{' '}
            <span className="font-medium text-fupe-text">
              {preview.email_masked}
            </span>{' '}
            from occasional FUPE product updates?
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="rounded-full bg-fupe-text px-6 py-2.5 text-sm font-semibold text-fupe-bg transition hover:bg-fupe-accent disabled:opacity-40"
          >
            {busy ? 'Working…' : 'Unsubscribe'}
          </button>
          <p className="text-xs text-fupe-accentDim">
            This does not affect account or billing email.
          </p>
        </>
      ) : !error ? (
        <p className="text-fupe-muted">Checking link…</p>
      ) : null}
    </div>
  );
}

export function UnsubscribeClient() {
  return (
    <Suspense
      fallback={<p className="mt-10 text-center text-fupe-muted">Loading…</p>}
    >
      <UnsubscribeInner />
    </Suspense>
  );
}
