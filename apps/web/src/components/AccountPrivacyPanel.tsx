'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  clearSession,
  deleteMyAccount,
  exportMyData,
  getToken,
} from '@/lib/auth';

export function AccountPrivacyPanel({
  onDeleted,
}: {
  onDeleted?: () => void;
}) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function doExport() {
    const token = getToken();
    if (!token) {
      setMsg('Sign in again.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const data = await exportMyData(token);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fupe-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg('Download started.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (
      !window.confirm(
        'Permanently delete your account and personal data? This cannot be undone.',
      )
    ) {
      return;
    }
    const token = getToken();
    if (!token) {
      setMsg('Sign in again.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await deleteMyAccount(token);
      clearSession();
      onDeleted?.();
      setMsg('Account deleted.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-fupe-border bg-fupe-surface p-5">
      <h2 className="font-semibold text-fupe-text">Your data</h2>
      <p className="mt-2 text-sm text-fupe-muted">
        GDPR access &amp; erasure — see the{' '}
        <Link href="/legal/privacy" className="text-fupe-text hover:underline">
          Privacy Policy
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void doExport()}
          className="rounded-full border border-fupe-border px-4 py-1.5 text-sm text-fupe-text hover:border-fupe-muted disabled:opacity-50"
        >
          Download my data
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void doDelete()}
          className="rounded-full border border-verdict-yes/40 px-4 py-1.5 text-sm text-verdict-yes hover:border-verdict-yes disabled:opacity-50"
        >
          Delete account
        </button>
      </div>
      {msg ? <p className="mt-3 text-xs text-fupe-muted">{msg}</p> : null}
    </div>
  );
}
