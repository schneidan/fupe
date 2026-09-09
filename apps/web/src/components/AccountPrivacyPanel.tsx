'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import {
  clearSession,
  deleteMyAccount,
  exportMyData,
  getToken,
  type AuthUser,
} from '@/lib/auth';

function formatPaidThrough(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function hasActivePaidPlan(user: AuthUser | null): boolean {
  if (!user) return false;
  const tier = user.subscription_tier ?? 'free';
  if (tier === 'free') return false;
  const status = (user.subscription_status ?? '').toLowerCase();
  if (status === 'canceled' || status === 'cancelled') return false;
  return true;
}

export function AccountPrivacyPanel({
  user,
  onDeleted,
}: {
  user?: AuthUser | null;
  onDeleted?: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [reallySure, setReallySure] = useState(false);

  const paidThrough = formatPaidThrough(user?.subscription_current_period_end);
  const paid = hasActivePaidPlan(user ?? null);

  async function doExport() {
    const token = getToken();
    if (!token) {
      setMsg('Sign in again.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const data = await exportMyData(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fupe-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('Download started.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  function openDeleteConfirm() {
    setPassword('');
    setReallySure(false);
    setMsg(null);
    setConfirmOpen(true);
  }

  async function onConfirmDelete(e: FormEvent) {
    e.preventDefault();
    if (!reallySure || !password.trim()) return;
    const token = getToken();
    if (!token) {
      setMsg('Sign in again.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await deleteMyAccount(token, password);
      clearSession();
      setConfirmOpen(false);
      onDeleted?.();
      setMsg('Account deleted. Thanks for trying FUPE.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-fupe-border bg-fupe-surface p-5">
      <h2 className="font-semibold text-fupe-text">Your data</h2>
      <p className="mt-2 text-sm text-fupe-muted">
        GDPR access &amp; erasure — see the{' '}
        <Link href="/legal/privacy" className="text-fupe-text hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void doExport()}
          className="rounded-full border border-fupe-border px-4 py-1.5 text-sm text-fupe-text hover:border-fupe-muted disabled:opacity-50"
        >
          Download my data
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={openDeleteConfirm}
          className="rounded-full border border-verdict-yes/40 px-4 py-1.5 text-sm text-verdict-yes hover:border-verdict-yes disabled:opacity-50"
        >
          Delete account
        </button>
      </div>
      {msg && !confirmOpen ? (
        <p className="mt-3 text-xs text-fupe-muted" role="status">
          {msg}
        </p>
      ) : null}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !busy && setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl border border-fupe-border bg-fupe-bg p-6 shadow-xl"
            onClick={(ev) => ev.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <h3
              id="delete-account-title"
              className="text-lg font-semibold text-fupe-text"
            >
              Delete your account?
            </h3>
            <div className="mt-3 space-y-3 text-sm text-fupe-muted">
              <p>
                This permanently removes your personal data and signs you out.
                Directory contributions you made stay in FUPE, but won&apos;t be
                linked to your name anymore.
              </p>
              {paid ? (
                <p>
                  {paidThrough
                    ? `Your paid plan is covered through ${paidThrough}. `
                    : 'You currently have a paid plan. '}
                  Deleting cancels it right away so it won&apos;t renew. We
                  can&apos;t refund the unused time on the current period —
                  sorry about that, it&apos;s just how billing works here.
                </p>
              ) : null}
              <p>
                Any one-time “keep the lights on” tips stay as anonymous support
                — those aren&apos;t refundable either.
              </p>
              <p className="font-medium text-fupe-text">
                Are you sure you want to continue?
              </p>
            </div>
            <form onSubmit={onConfirmDelete} className="mt-4 space-y-3">
              <label className="flex items-start gap-2 text-sm text-fupe-muted">
                <input
                  type="checkbox"
                  checked={reallySure}
                  onChange={(ev) => setReallySure(ev.target.checked)}
                  className="mt-1"
                  disabled={busy}
                />
                <span>Yes, I understand this can&apos;t be undone.</span>
              </label>
              <label className="block text-sm">
                <span className="text-fupe-muted">Confirm with your password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(ev) => setPassword(ev.target.value)}
                  autoComplete="current-password"
                  required
                  disabled={busy}
                  className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-elevated px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
                />
              </label>
              {msg ? (
                <p className="text-sm text-verdict-yes" role="alert">
                  {msg}
                </p>
              ) : null}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmOpen(false)}
                  className="rounded-lg border border-fupe-border px-4 py-2 text-sm text-fupe-muted hover:text-fupe-text disabled:opacity-40"
                >
                  Keep my account
                </button>
                <button
                  type="submit"
                  disabled={busy || !reallySure || !password.trim()}
                  className="rounded-lg border border-verdict-yes bg-verdict-yes/15 px-4 py-2 text-sm font-semibold text-verdict-yes disabled:opacity-40"
                >
                  {busy ? 'Deleting…' : 'Delete permanently'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
