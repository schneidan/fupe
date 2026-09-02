'use client';

import { useEffect, useState } from 'react';
import {
  listEditQueue,
  reviewEdit,
  type QueueEdit,
} from '@/lib/api';
import { getToken, isModerator, getStoredUser, fetchMe } from '@/lib/auth';

function summarize(edit: QueueEdit): string {
  const p = edit.proposed_data;
  if (p.ownership?.parent_id) {
    return `Link parent ${p.ownership.parent_id}${
      p.ownership.percentage != null ? ` (${p.ownership.percentage}%)` : ''
    }`;
  }
  if (p.new_parent) {
    return `New parent “${p.new_parent.name}” (${p.new_parent.type.replace(/_/g, ' ')})`;
  }
  if (p.entity) {
    return `Update entity${p.entity.name ? `: ${p.entity.name}` : ''}`;
  }
  return 'Edit';
}

export function AdminEditsQueue() {
  const [edits, setEdits] = useState<QueueEdit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);

  async function load() {
    const token = getToken();
    if (!token) {
      setError('Sign in as a moderator to review edits.');
      setLoading(false);
      setAllowed(false);
      return;
    }
    const me = (await fetchMe()) ?? getStoredUser();
    if (!isModerator(me)) {
      setError('Moderator role required.');
      setLoading(false);
      setAllowed(false);
      return;
    }
    setAllowed(true);
    setLoading(true);
    setError(null);
    try {
      const res = await listEditQueue(token);
      setEdits(res.edits);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function decide(id: string, decision: 'APPROVED' | 'REJECTED') {
    const token = getToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await reviewEdit(token, id, decision);
      setEdits((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-fupe-muted">Loading queue…</p>;
  }

  if (!allowed) {
    return <p className="text-sm text-verdict-yes">{error}</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-sm text-verdict-yes">{error}</p> : null}
      {edits.length === 0 ? (
        <p className="text-sm text-fupe-muted">No pending edits. Nice.</p>
      ) : (
        <ul className="space-y-3">
          {edits.map((edit) => (
            <li
              key={edit.id}
              className="rounded-xl border border-fupe-border bg-fupe-surface px-4 py-4"
            >
              <p className="text-sm text-fupe-text">{summarize(edit)}</p>
              <p className="mt-1 font-mono text-xs text-fupe-muted">
                target: {edit.target_node_id}
              </p>
              {edit.submitter_email ? (
                <p className="mt-1 text-xs text-fupe-muted">
                  from {edit.submitter_email}
                  {edit.submitter_trust != null
                    ? ` · trust ${edit.submitter_trust}`
                    : ''}
                </p>
              ) : null}
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
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === edit.id}
                  onClick={() => decide(edit.id, 'APPROVED')}
                  className="rounded-full bg-fupe-text px-4 py-1.5 text-sm font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === edit.id}
                  onClick={() => decide(edit.id, 'REJECTED')}
                  className="rounded-full border border-fupe-border px-4 py-1.5 text-sm text-fupe-muted hover:text-fupe-text disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={() => void load()}
        className="text-sm text-fupe-muted hover:text-fupe-text"
      >
        Refresh
      </button>
    </div>
  );
}
