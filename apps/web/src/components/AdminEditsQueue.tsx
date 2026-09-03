'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listEditQueue,
  reopenEdit,
  reviewEdit,
  type EditKindFilter,
  type EditStatus,
  type QueueEdit,
} from '@/lib/api';
import { summarizeEdit } from '@/lib/edit-summary';
import { getToken, isModerator, getStoredUser, fetchMe } from '@/lib/auth';

type StatusFilter = EditStatus | 'ALL';

export function AdminEditsQueue() {
  const [edits, setEdits] = useState<QueueEdit[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [status, setStatus] = useState<StatusFilter>('PENDING');
  const [kind, setKind] = useState<EditKindFilter | ''>('');
  const [submitter, setSubmitter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
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
      const res = await listEditQueue(token, {
        status,
        kind: kind || undefined,
        submitter: submitter || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: 50,
      });
      setEdits(res.edits);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load queue');
    } finally {
      setLoading(false);
    }
  }, [status, kind, submitter, from, to, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: 'APPROVED' | 'REJECTED') {
    const token = getToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await reviewEdit(token, id, decision, notes[id]);
      setNotes((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed');
    } finally {
      setBusyId(null);
    }
  }

  async function reopen(id: string) {
    const token = getToken();
    if (!token) return;
    setBusyId(id);
    setError(null);
    try {
      await reopenEdit(token, id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reopen failed');
    } finally {
      setBusyId(null);
    }
  }

  if (!allowed && !loading) {
    return <p className="text-sm text-verdict-yes">{error}</p>;
  }

  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['PENDING', 'Pending'],
            ['APPROVED', 'Approved'],
            ['REJECTED', 'Rejected'],
            ['ALL', 'All'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              status === value
                ? 'bg-fupe-text text-fupe-bg'
                : 'border border-fupe-border text-fupe-muted hover:text-fupe-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={kind}
          onChange={(e) => {
            setKind(e.target.value as EditKindFilter | '');
            setPage(1);
          }}
          className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-text"
        >
          <option value="">All types</option>
          <option value="ownership">Ownership</option>
          <option value="create_entity">New entity</option>
          <option value="other">Other</option>
        </select>
        <input
          type="search"
          placeholder="Submitter email…"
          value={submitter}
          onChange={(e) => {
            setSubmitter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-text outline-none placeholder:text-fupe-muted"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-text"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-text"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-fupe-border px-3 py-2 text-sm text-fupe-text hover:border-fupe-muted"
        >
          Refresh
        </button>
      </div>

      <p className="text-xs text-fupe-muted">{total} matching</p>
      {error ? <p className="text-sm text-verdict-yes">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-fupe-muted">Loading queue…</p>
      ) : edits.length === 0 ? (
        <p className="text-sm text-fupe-muted">No edits match these filters.</p>
      ) : (
        <ul className="space-y-3">
          {edits.map((edit) => (
            <li
              key={edit.id}
              className="rounded-xl border border-fupe-border bg-fupe-surface px-4 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-fupe-elevated px-1.5 py-0.5 text-xs text-fupe-muted">
                  {edit.edit_kind ?? 'edit'}
                </span>
                <span className="rounded bg-fupe-elevated px-1.5 py-0.5 text-xs text-fupe-muted">
                  {edit.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-fupe-text">{summarizeEdit(edit)}</p>
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
                Submitted {new Date(edit.created_at).toLocaleString()}
                {edit.reviewed_at
                  ? ` · reviewed ${new Date(edit.reviewed_at).toLocaleString()}`
                  : ''}
                {edit.reviewer_email ? ` by ${edit.reviewer_email}` : ''}
              </p>
              {edit.review_note ? (
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-xs text-fupe-muted">
                  Note: {edit.review_note}
                </p>
              ) : null}

              {edit.status === 'PENDING' ? (
                <>
                  <label className="mt-3 block text-xs text-fupe-muted">
                    Review note (optional)
                    <textarea
                      value={notes[edit.id] ?? ''}
                      onChange={(e) =>
                        setNotes((prev) => ({
                          ...prev,
                          [edit.id]: e.target.value,
                        }))
                      }
                      rows={2}
                      className="mt-1 w-full rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-text outline-none focus:border-fupe-muted"
                      placeholder="Why approve or reject…"
                    />
                  </label>
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
                </>
              ) : null}

              {edit.can_reopen ? (
                <button
                  type="button"
                  disabled={busyId === edit.id}
                  onClick={() => reopen(edit.id)}
                  className="mt-3 rounded-full border border-fupe-border px-4 py-1.5 text-sm text-fupe-text hover:border-fupe-muted disabled:opacity-60"
                >
                  Reopen to pending
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {pages > 1 ? (
        <div className="flex items-center gap-3 text-sm text-fupe-muted">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded border border-fupe-border px-3 py-1 hover:text-fupe-text disabled:opacity-40"
          >
            ←
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
            disabled={page === pages}
            className="rounded border border-fupe-border px-3 py-1 hover:text-fupe-text disabled:opacity-40"
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}
