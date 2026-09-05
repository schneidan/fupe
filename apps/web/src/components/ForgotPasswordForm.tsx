'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { forgotPassword } from '@/lib/auth';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      const message = await forgotPassword(email.trim());
      setDone(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4 rounded-xl border border-fupe-border bg-fupe-surface p-6">
        <p className="text-sm text-fupe-text">{done}</p>
        <p className="text-xs text-fupe-muted">
          Check your inbox (and spam). The link expires in one hour.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-fupe-text underline decoration-fupe-border underline-offset-2 hover:decoration-fupe-muted"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-xl border border-fupe-border bg-fupe-surface p-6"
    >
      <p className="text-sm text-fupe-muted">
        Enter your account email and we&apos;ll send a reset link if it matches
        an account.
      </p>
      <label className="block text-sm">
        <span className="text-fupe-muted">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
        />
      </label>
      {error ? <p className="text-sm text-verdict-yes">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-fupe-text px-5 py-2.5 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-60"
      >
        {busy ? 'Sending…' : 'Send reset link'}
      </button>
      <p className="text-center text-sm text-fupe-muted">
        <Link href="/login" className="text-fupe-text hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
