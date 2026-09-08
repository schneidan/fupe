'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { submitEdit } from '@/lib/api';
import { getStoredUser, getToken } from '@/lib/auth';

/**
 * Lightweight tip: name (+ optional note). Goes to the suggest_entity queue for
 * moderator / future AI enrichment — no parent, sector, or citation required.
 */
export function SuggestEntityForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState(() => searchParams.get('name')?.trim() ?? '');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const registerHref = useMemo(
    () =>
      `/register?next=${encodeURIComponent(
        `/contribute/suggest-entity${name ? `?name=${encodeURIComponent(name)}` : ''}`,
      )}`,
    [name],
  );
  const loginHref = useMemo(
    () =>
      `/login?next=${encodeURIComponent(
        `/contribute/suggest-entity${name ? `?name=${encodeURIComponent(name)}` : ''}`,
      )}`,
    [name],
  );

  useEffect(() => {
    setSignedIn(Boolean(getToken() && getStoredUser()));
    const onAuth = () =>
      setSignedIn(Boolean(getToken() && getStoredUser()));
    window.addEventListener('fupe-auth', onAuth);
    return () => window.removeEventListener('fupe-auth', onAuth);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const token = getToken();
    if (!token || !getStoredUser()) {
      router.push(registerHref);
      return;
    }
    if (!name.trim()) {
      setError('A name is required.');
      return;
    }

    setBusy(true);
    try {
      const result = await submitEdit(token, {
        proposed_data: {
          suggest_entity: {
            name: name.trim(),
            ...(notes.trim() ? { notes: notes.trim() } : {}),
          },
        },
      });
      setSuccess(
        result.status === 'committed'
          ? 'Suggestion applied.'
          : 'Thanks — we queued your tip for review.',
      );
      setTimeout(() => router.push('/account/edits'), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submit failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <label className="block text-sm">
        <span className="text-fupe-muted">Brand or company name</span>
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Utz"
          className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
        />
      </label>

      <label className="block text-sm">
        <span className="text-fupe-muted">Anything else? (optional)</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          rows={3}
          placeholder="Product type, where you saw it, spelling variants…"
          className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-fupe-text outline-none focus:border-fupe-muted"
        />
      </label>

      <p className="text-sm text-fupe-muted">
        No citation, parent, or sector needed. We’ll flesh this out in review
        (and later with AI assist). Know the full details already?{' '}
        <Link
          href={`/contribute/new-entity${name.trim() ? `?name=${encodeURIComponent(name.trim())}` : ''}`}
          className="text-fupe-text hover:underline"
        >
          Add entity
        </Link>{' '}
        instead.
      </p>

      {error ? <p className="text-sm text-verdict-yes">{error}</p> : null}
      {success ? <p className="text-sm text-fupe-text">{success}</p> : null}

      {!signedIn ? (
        <div className="rounded-lg border border-fupe-border bg-fupe-bg px-4 py-3 text-sm text-fupe-muted">
          <p className="font-medium text-fupe-text">
            Create a free account to suggest this entity
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link
              href={registerHref}
              className="rounded-full bg-fupe-text px-4 py-1.5 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted"
            >
              Create free account
            </Link>
            <Link
              href={loginHref}
              className="rounded-full border border-fupe-border px-4 py-1.5 text-sm text-fupe-text hover:border-fupe-muted"
            >
              Sign in
            </Link>
          </div>
        </div>
      ) : getStoredUser() && !getStoredUser()!.email_verified ? (
        <p className="text-sm text-fupe-muted">
          Verify your email first — see{' '}
          <Link href="/account" className="text-fupe-text hover:underline">
            Account
          </Link>
          .
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-fupe-text px-6 py-2.5 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-60"
      >
        {busy ? 'Submitting…' : 'Suggest entity'}
      </button>
    </form>
  );
}
