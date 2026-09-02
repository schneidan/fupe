'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  clearSession,
  getStoredUser,
  type AuthUser,
} from '@/lib/auth';

export function ContributeHub() {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    sync();
    window.addEventListener('fupe-auth', sync);
    return () => window.removeEventListener('fupe-auth', sync);
  }, []);

  return (
    <div className="mt-10 space-y-8">
      <div className="rounded-xl border border-fupe-border bg-fupe-surface p-6">
        {user ? (
          <div className="space-y-3">
            <p className="text-sm text-fupe-muted">Signed in as</p>
            <p className="font-medium text-fupe-text">{user.email}</p>
            <p className="text-xs text-fupe-muted">
              Trust score {user.trust_score}
              {user.trust_score > 50
                ? ' · your edits auto-commit'
                : ' · your edits need review'}
            </p>
            <button
              type="button"
              onClick={() => {
                clearSession();
                setUser(null);
              }}
              className="text-sm text-fupe-muted hover:text-fupe-text"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-fupe-muted">
              Create a free account to suggest corrections.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register?next=/contribute"
                className="rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted"
              >
                Create account
              </Link>
              <Link
                href="/login?next=/contribute"
                className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text hover:border-fupe-muted"
              >
                Sign in
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/contribute/suggest"
          className="rounded-xl border border-fupe-border bg-fupe-surface p-5 transition hover:border-fupe-muted"
        >
          <h2 className="font-semibold text-fupe-text">Suggest an edit</h2>
          <p className="mt-2 text-sm text-fupe-muted">
            Propose a parent or ownership change with a citation URL.
          </p>
        </Link>
        <Link
          href="/contribute/edits"
          className="rounded-xl border border-fupe-border bg-fupe-surface p-5 transition hover:border-fupe-muted"
        >
          <h2 className="font-semibold text-fupe-text">My edits</h2>
          <p className="mt-2 text-sm text-fupe-muted">
            Track pending, approved, and rejected suggestions.
          </p>
        </Link>
      </div>

      <p className="text-sm text-fupe-muted">
        Tip: open any entity or lookup result and tap{' '}
        <span className="text-fupe-text">Suggest an edit</span> to prefill the
        target.
      </p>
    </div>
  );
}
