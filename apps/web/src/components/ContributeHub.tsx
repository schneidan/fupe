'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  clearSession,
  fetchMe,
  getStoredUser,
  getToken,
  isModerator,
  resendVerification,
  type AuthUser,
} from '@/lib/auth';
import { AccountPrivacyPanel } from '@/components/AccountPrivacyPanel';

export function ContributeHub() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    sync();
    void fetchMe().then((me) => {
      if (me) setUser(me);
    });
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
                ? ' · ownership edits auto-commit'
                : ' · edits need review'}
              {isModerator(user) ? ' · moderator' : ''}
            </p>
            {!user.email_verified ? (
              <div className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm">
                <p className="text-fupe-muted">
                  Verify your email before submitting edits. Locally, open{' '}
                  <a
                    href="http://localhost:8025"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fupe-text underline-offset-2 hover:underline"
                  >
                    Mailpit
                  </a>{' '}
                  after resending (or check the API logs if SMTP isn&apos;t set).
                </p>
                <button
                  type="button"
                  className="mt-2 text-fupe-text underline-offset-2 hover:underline"
                  onClick={async () => {
                    const token = getToken();
                    if (!token) {
                      setResendMsg('Sign in again, then retry.');
                      return;
                    }
                    setResendMsg('Sending…');
                    try {
                      const msg = await resendVerification(token);
                      setResendMsg(
                        `${msg} — check Mailpit (localhost:8025) or your inbox.`,
                      );
                      await fetchMe();
                    } catch (e) {
                      setResendMsg(
                        e instanceof Error ? e.message : 'Resend failed',
                      );
                    }
                  }}
                >
                  Resend verification
                </button>
                {resendMsg ? (
                  <p className="mt-1 text-xs text-fupe-muted">{resendMsg}</p>
                ) : null}
              </div>
            ) : null}
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
            <div className="pt-2">
              <AccountPrivacyPanel onDeleted={() => setUser(null)} />
            </div>
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
          href="/contribute/new-entity"
          className="rounded-xl border border-fupe-border bg-fupe-surface p-5 transition hover:border-fupe-muted"
        >
          <h2 className="font-semibold text-fupe-text">Propose new entity</h2>
          <p className="mt-2 text-sm text-fupe-muted">
            Add a missing brand or company — always reviewed by a moderator.
          </p>
        </Link>
        <Link
          href="/contribute/edits"
          className="rounded-xl border border-fupe-border bg-fupe-surface p-5 transition hover:border-fupe-muted sm:col-span-2"
        >
          <h2 className="font-semibold text-fupe-text">My edits</h2>
          <p className="mt-2 text-sm text-fupe-muted">
            Track pending, approved, and rejected suggestions.
          </p>
        </Link>
        {isModerator(user) ? (
          <Link
            href="/admin/edits"
            className="rounded-xl border border-fupe-border bg-fupe-surface p-5 transition hover:border-fupe-muted sm:col-span-2"
          >
            <h2 className="font-semibold text-fupe-text">Moderate queue</h2>
            <p className="mt-2 text-sm text-fupe-muted">
              Approve or reject pending community edits.
            </p>
          </Link>
        ) : null}
      </div>

      <p className="text-sm text-fupe-muted">
        Tip: open any entity or lookup result and tap{' '}
        <span className="text-fupe-text">Suggest an edit</span> to prefill the
        target. Max 5 pending edits per account.
      </p>
    </div>
  );
}
