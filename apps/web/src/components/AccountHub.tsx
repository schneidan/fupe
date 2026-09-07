'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  clearSession,
  fetchMe,
  getStoredUser,
  getToken,
  isModerator,
  resendVerification,
  updateMe,
  type AuthUser,
} from '@/lib/auth';
import { AccountPrivacyPanel } from '@/components/AccountPrivacyPanel';

export function AccountHub() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [updatesOptIn, setUpdatesOptIn] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sync = () => {
      const u = getStoredUser();
      setUser(u);
      if (u) {
        setDisplayName(u.display_name ?? '');
        setUpdatesOptIn(Boolean(u.email_updates_opt_in));
      }
    };
    sync();
    void fetchMe().then((me) => {
      if (me) {
        setUser(me);
        setDisplayName(me.display_name ?? '');
        setUpdatesOptIn(Boolean(me.email_updates_opt_in));
      }
    });
    window.addEventListener('fupe-auth', sync);
    return () => window.removeEventListener('fupe-auth', sync);
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const token = getToken();
    if (!token) {
      setSaveMsg('Sign in again.');
      return;
    }
    setBusy(true);
    setSaveMsg(null);
    try {
      const updated = await updateMe(token, {
        display_name: displayName.trim() || null,
        email_updates_opt_in: updatesOptIn,
      });
      setUser(updated);
      setSaveMsg('Saved.');
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="mt-10 space-y-6">
        <div className="rounded-xl border border-fupe-border bg-fupe-surface p-6">
          <p className="text-sm text-fupe-muted">
            Create a free account to suggest edits, track your contributions, and
            manage contact preferences.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href="/register?next=/account"
              className="rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted"
            >
              Create free account
            </Link>
            <Link
              href="/login?next=/account"
              className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text hover:border-fupe-muted"
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-8">
      <div className="rounded-xl border border-fupe-border bg-fupe-surface p-6 space-y-3">
        <p className="text-sm text-fupe-muted">Signed in as</p>
        <p className="font-medium text-fupe-text">{user.email}</p>
        <p className="text-xs text-fupe-muted">
          Trust score {user.trust_score}
          {user.trust_score > 50
            ? ' · ownership edits auto-commit'
            : ' · ownership edits need review'}
          {isModerator(user) ? ` · ${user.role}` : ''}
        </p>
        <details className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-muted">
          <summary className="cursor-pointer text-fupe-text">
            How trust works
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed">
            <li>New accounts start at 0 — edits go to the moderator queue.</li>
            <li>
              Approved ownership edits: <span className="text-fupe-text">+5</span>.
              Rejected: <span className="text-fupe-text">−10</span>.
            </li>
            <li>
              Score above <span className="text-fupe-text">50</span>: ownership
              parent edits auto-commit (still need a citation).
            </li>
            <li>
              Proposing a <span className="text-fupe-text">new entity</span> is
              always reviewed, regardless of trust.
            </li>
            <li>Max 5 pending edits per account at a time.</li>
          </ul>
        </details>
        {!user.email_verified ? (
          <div className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm">
            <p className="text-fupe-muted">
              Verify your email before submitting edits. Check your inbox (and
              spam) for the link from FUPE.
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
                  setResendMsg(`${msg} — check your inbox.`);
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
      </div>

      <form
        onSubmit={onSave}
        className="rounded-xl border border-fupe-border bg-fupe-surface p-6 space-y-4"
      >
        <h2 className="font-semibold text-fupe-text">Profile &amp; contact</h2>
        <label className="block text-sm">
          <span className="text-fupe-muted">Display name (optional)</span>
          <input
            type="text"
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="How you’d like to be addressed"
            className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
          />
        </label>
        <label className="block text-sm">
          <span className="text-fupe-muted">Email</span>
          <input
            type="email"
            disabled
            value={user.email}
            className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-muted outline-none"
          />
          <span className="mt-1 block text-xs text-fupe-muted">
            Email changes aren’t supported yet — contact support if you need a
            different address.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm text-fupe-muted">
          <input
            type="checkbox"
            className="mt-1"
            checked={updatesOptIn}
            onChange={(e) => setUpdatesOptIn(e.target.checked)}
          />
          <span>
            Receive occasional updates from FUPE (major features, important
            product news). Transactional mail about your edits is always sent.
            See the{' '}
            <Link href="/legal/privacy" className="text-fupe-text hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Save preferences'}
        </button>
        {saveMsg ? <p className="text-xs text-fupe-muted">{saveMsg}</p> : null}
      </form>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/account/edits"
          className="rounded-xl border border-fupe-border bg-fupe-surface p-5 transition hover:border-fupe-muted sm:col-span-2"
        >
          <h2 className="font-semibold text-fupe-text">My edits</h2>
          <p className="mt-2 text-sm text-fupe-muted">
            Track pending, approved, and rejected suggestions.
          </p>
        </Link>
        <Link
          href="/contribute"
          className="rounded-xl border border-fupe-border bg-fupe-surface p-5 transition hover:border-fupe-muted sm:col-span-2"
        >
          <h2 className="font-semibold text-fupe-text">Contribute</h2>
          <p className="mt-2 text-sm text-fupe-muted">
            Suggest ownership edits or propose a missing entity.
          </p>
        </Link>
      </div>

      <AccountPrivacyPanel onDeleted={() => setUser(null)} />
    </div>
  );
}
