'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  fetchMe,
  getStoredUser,
  isModerator,
  type AuthUser,
} from '@/lib/auth';

export function ContributeHub() {
  const [user, setUser] = useState<AuthUser | null>(null);

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
      {!user ? (
        <div className="rounded-xl border border-fupe-border bg-fupe-surface p-6 space-y-3">
          <p className="text-sm text-fupe-muted">
            Create a free account to suggest corrections. You can browse the
            forms below; submitting requires sign-in.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/register?next=/contribute"
              className="rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted"
            >
              Create free account
            </Link>
            <Link
              href="/login?next=/contribute"
              className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text hover:border-fupe-muted"
            >
              Sign in
            </Link>
          </div>
        </div>
      ) : (
        <p className="text-sm text-fupe-muted">
          Signed in as {user.email}. Manage profile and edit history on your{' '}
          <Link href="/account" className="text-fupe-text hover:underline">
            account
          </Link>{' '}
          page.
        </p>
      )}

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
          href="/contribute/suggest-entity"
          className="rounded-xl border border-fupe-border bg-fupe-surface p-5 transition hover:border-fupe-muted"
        >
          <h2 className="font-semibold text-fupe-text">Suggest an entity</h2>
          <p className="mt-2 text-sm text-fupe-muted">
            Name-only tip for something missing — we&apos;ll enrich it in review.
          </p>
        </Link>
        <Link
          href="/contribute/new-entity"
          className="rounded-xl border border-fupe-border bg-fupe-surface p-5 transition hover:border-fupe-muted sm:col-span-2"
        >
          <h2 className="font-semibold text-fupe-text">Add entity</h2>
          <p className="mt-2 text-sm text-fupe-muted">
            Full details (type, citation, optional parent). High trust can
            auto-commit.
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
        target. Max 5 pending edits per account. Track submissions from{' '}
        <Link href="/account/edits" className="text-fupe-text hover:underline">
          My edits
        </Link>
        .
      </p>
    </div>
  );
}
