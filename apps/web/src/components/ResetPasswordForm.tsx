'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { resetPassword } from '@/lib/auth';

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError('Missing reset token. Open the link from your email again.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const message = await resetPassword(token, password);
      setDone(message);
      window.setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 rounded-xl border border-fupe-border bg-fupe-surface p-6">
        <p className="text-sm text-verdict-yes">
          Missing reset token. Request a new link from the forgot-password page.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm text-fupe-text underline"
        >
          Forgot password
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-xl border border-fupe-border bg-fupe-surface p-6">
        <p className="text-sm text-fupe-text">{done}</p>
        <Link
          href="/login"
          className="inline-block rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-fupe-border bg-fupe-surface p-6"
    >
      <label className="block text-sm">
        <span className="text-fupe-muted">New password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
        />
      </label>
      <label className="block text-sm">
        <span className="text-fupe-muted">Confirm password</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
        />
      </label>
      {error ? <p className="text-sm text-verdict-yes">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-fupe-text px-5 py-2.5 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-60"
      >
        {busy ? 'Saving…' : 'Update password'}
      </button>
    </form>
  );
}
