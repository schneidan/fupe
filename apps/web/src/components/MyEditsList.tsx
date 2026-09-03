'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { listMyEdits, type EditStatus, type QueueEdit } from '@/lib/api';
import { summarizeEdit } from '@/lib/edit-summary';
import { getToken } from '@/lib/auth';

const TABS: Array<{ id: EditStatus | 'ALL'; label: string }> = [
  { id: 'ALL', label: 'All' },
  { id: 'PENDING', label: 'Pending' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'REJECTED', label: 'Rejected' },
];

function statusColor(status: EditStatus) {
  switch (status) {
    case 'PENDING':
      return 'text-fupe-muted';
    case 'APPROVED':
      return 'text-fupe-text';
    case 'REJECTED':
      return 'text-verdict-yes';
  }
}

function summarize(edit: QueueEdit): string {
  return summarizeEdit(edit);
}

function MyEditsInner() {
  const [tab, setTab] = useState<EditStatus | 'ALL'>('ALL');
  const [edits, setEdits] = useState<QueueEdit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      setError('Sign in to see your edits.');
      return;
    }
    setLoading(true);
    setError(null);
    listMyEdits(token, tab === 'ALL' ? undefined : tab)
      .then((res) => setEdits(res.edits))
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load edits'),
      )
      .finally(() => setLoading(false));
  }, [tab]);

  if (!getToken()) {
    return (
      <p className="text-sm text-fupe-muted">
        <Link href="/login?next=/contribute/edits" className="text-fupe-text hover:underline">
          Sign in
        </Link>{' '}
        to track pending, approved, and rejected suggestions.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              tab === t.id
                ? 'bg-fupe-text text-fupe-bg'
                : 'border border-fupe-border text-fupe-muted hover:text-fupe-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-fupe-muted">Loading…</p>
      ) : error ? (
        <p className="text-sm text-verdict-yes">{error}</p>
      ) : edits.length === 0 ? (
        <p className="text-sm text-fupe-muted">No edits in this view yet.</p>
      ) : (
        <ul className="space-y-3">
          {edits.map((edit) => (
            <li
              key={edit.id}
              className="rounded-xl border border-fupe-border bg-fupe-surface px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-sm text-fupe-text">{summarize(edit)}</p>
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${statusColor(edit.status)}`}
                >
                  {edit.status}
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-fupe-muted">
                target: {edit.target_node_id}
              </p>
              {edit.citation_url ? (
                <a
                  href={edit.citation_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-xs text-fupe-accent underline-offset-2 hover:underline"
                >
                  Citation
                </a>
              ) : null}
              <p className="mt-2 text-xs text-fupe-muted">
                {new Date(edit.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MyEditsList() {
  return (
    <Suspense fallback={<p className="text-sm text-fupe-muted">Loading…</p>}>
      <MyEditsInner />
    </Suspense>
  );
}
