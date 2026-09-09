'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getStoredUser,
  type AuthUser,
} from '@/lib/auth';

export function SuggestEditLink({
  entityId,
  name,
}: {
  entityId?: string;
  name: string;
}) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    function syncUser() {
      setUser(getStoredUser());
    }
    syncUser();
    window.addEventListener('fupe-auth', syncUser);
    return () => window.removeEventListener('fupe-auth', syncUser);
  }, []);

  if (!entityId) {
    return (
      <p className="text-center text-sm text-fupe-muted">
        Spot an error?{' '}
        <Link href="/contribute" className="text-fupe-text hover:underline">
          Contribute
        </Link>
      </p>
    );
  }

  const suggestHref = `/contribute/suggest?entity_id=${encodeURIComponent(entityId)}&name=${encodeURIComponent(name)}`;
  const loginHref = `/login?next=${encodeURIComponent(suggestHref)}`;
  const registerHref = `/register?next=${encodeURIComponent(suggestHref)}`;

  if (!user) {
    return (
      <div className="rounded-xl border border-fupe-border bg-fupe-surface p-5 text-center">
        <p className="text-sm text-fupe-muted">
          Spot something off for{' '}
          <span className="font-medium text-fupe-text">{name}</span>? Sign in to
          suggest a correction with a citation.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            href={loginHref}
            className="rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg transition hover:bg-fupe-accent"
          >
            Sign in to suggest an edit
          </Link>
          <Link
            href={registerHref}
            className="text-sm text-fupe-muted hover:text-fupe-text"
          >
            Create account
          </Link>
        </div>
        <p className="mt-3 text-xs text-fupe-accentDim">
          After signing in you&apos;ll land on the edit form for this entity.
        </p>
      </div>
    );
  }

  return (
    <div className="text-center">
      <Link
        href={suggestHref}
        className="inline-block rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text transition hover:border-fupe-muted hover:bg-fupe-surface"
      >
        Suggest an edit
      </Link>
      <p className="mt-2 text-xs text-fupe-muted">
        Propose a parent / ownership change with a citation
      </p>
    </div>
  );
}
