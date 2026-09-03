'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  clearSession,
  getStoredUser,
  login,
  register,
  type AuthUser,
} from '@/lib/auth';

type Mode = 'login' | 'register';

export function AuthForm({ initialMode = 'login' }: { initialMode?: Mode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const next =
    searchParams.get('next') ||
    (pathname.startsWith('/admin') ? '/admin' : '/contribute');

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password);
      }
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  if (user) {
    return (
      <div className="space-y-4 rounded-xl border border-fupe-border bg-fupe-surface p-6">
        <p className="text-sm text-fupe-muted">Signed in as</p>
        <p className="font-medium text-fupe-text">{user.email}</p>
        <p className="text-xs text-fupe-muted">
          Trust score: {user.trust_score}
          {user.trust_score > 50 ? ' · edits auto-commit' : ' · edits go to review'}
          {user.email_verified ? '' : ' · email unverified'}
          {user.role === 'moderator' || user.role === 'admin'
            ? ` · ${user.role}`
            : ''}
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href={next}
            className="rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted"
          >
            Continue
          </Link>
          {user.role === 'admin' ? (
            <Link
              href="/admin"
              className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text hover:border-fupe-muted"
            >
              Admin
            </Link>
          ) : (
            <Link
              href="/contribute"
              className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text hover:border-fupe-muted"
            >
              Contribute
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              clearSession();
              setUser(null);
            }}
            className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-muted hover:text-fupe-text"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-fupe-border bg-fupe-surface p-6">
      <div className="mb-6 flex gap-4 text-sm">
        <button
          type="button"
          onClick={() => setMode('login')}
          className={
            mode === 'login'
              ? 'font-semibold text-fupe-text'
              : 'text-fupe-muted hover:text-fupe-text'
          }
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode('register')}
          className={
            mode === 'register'
              ? 'font-semibold text-fupe-text'
              : 'text-fupe-muted hover:text-fupe-text'
          }
        >
          Create account
        </button>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block text-sm">
          <span className="text-fupe-muted">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
          />
        </label>
        <label className="block text-sm">
          <span className="text-fupe-muted">Password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
          />
        </label>
        {error ? <p className="text-sm text-verdict-yes">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-full bg-fupe-text px-5 py-2.5 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-60"
        >
          {busy
            ? 'Please wait…'
            : mode === 'login'
              ? 'Sign in'
              : 'Create account'}
        </button>
      </form>
    </div>
  );
}
