'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  fetchMe,
  getStoredUser,
  getToken,
  setSession,
  verifyEmailToken,
} from '@/lib/auth';

export function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'working' | 'ok' | 'error'>(
    'idle',
  );
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token.');
      return;
    }
    setStatus('working');
    verifyEmailToken(token)
      .then(async (user) => {
        const existing = getToken();
        if (existing) {
          setSession({ token: existing, user });
          await fetchMe();
        } else {
          localStorage.setItem('fupe_user', JSON.stringify(user));
        }
        setStatus('ok');
        setMessage('Email verified. You can submit edits now.');
      })
      .catch((e) => {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Verification failed');
      });
  }, [token]);

  return (
    <div className="space-y-4">
      {status === 'working' ? (
        <p className="text-fupe-muted">Verifying…</p>
      ) : (
        <p
          className={
            status === 'ok' ? 'text-fupe-text' : 'text-verdict-yes'
          }
        >
          {message}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/contribute/suggest"
          className="rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted"
        >
          Suggest an edit
        </Link>
        <Link
          href="/contribute"
          className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text"
        >
          Contribute
        </Link>
      </div>
      {!getStoredUser() && status === 'ok' ? (
        <p className="text-sm text-fupe-muted">
          <Link href="/login" className="text-fupe-text hover:underline">
            Sign in
          </Link>{' '}
          to continue with this account.
        </p>
      ) : null}
    </div>
  );
}
