'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  clearSession,
  confirmEmailChangeToken,
  getToken,
} from '@/lib/auth';

export function ConfirmEmailChangeClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'idle' | 'working' | 'ok' | 'error'>(
    'idle',
  );
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing confirmation token.');
      return;
    }
    setStatus('working');
    confirmEmailChangeToken(token)
      .then((user) => {
        setEmail(user.email);
        // Confirming bumps token_version — existing JWTs are no longer valid.
        if (getToken()) clearSession();
        setMessage(
          `Email updated to ${user.email}. Sign in with your new address to continue.`,
        );
        setStatus('ok');
      })
      .catch((e) => {
        setStatus('error');
        setMessage(e instanceof Error ? e.message : 'Confirmation failed');
      });
  }, [token]);

  return (
    <div className="space-y-4">
      {status === 'working' ? (
        <p className="text-fupe-muted">Confirming…</p>
      ) : (
        <p
          className={
            status === 'ok' ? 'text-fupe-text' : 'text-verdict-yes'
          }
        >
          {message}
        </p>
      )}
      {email && status === 'ok' ? (
        <p className="text-sm text-fupe-muted">New address: {email}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/account"
          className="rounded-full bg-fupe-text px-5 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted"
        >
          Account
        </Link>
        <Link
          href="/login?next=/account"
          className="rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
