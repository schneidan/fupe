'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchIngestMatches,
  resolveIngestMatch,
  type IngestMatch,
} from '@/lib/admin-api';
import { getStoredUser } from '@/lib/auth';

function incomingName(match: IngestMatch): string {
  const ent = match.incoming_entity;
  const name = ent?.name;
  return typeof name === 'string' ? name : 'Incoming entity';
}

export function AdminIngestMatchesPanel() {
  const user = getStoredUser();
  const [matches, setMatches] = useState<IngestMatch[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (user?.role !== 'admin') {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchIngestMatches({ status: 'pending' });
      setMatches(res.matches);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ingest matches');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  if (user?.role !== 'admin') return null;

  async function resolve(
    id: string,
    decision: 'accepted' | 'rejected' | 'merged',
  ) {
    setBusyId(id);
    setError(null);
    try {
      await resolveIngestMatch(id, decision);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Resolve failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="space-y-4 border-t border-fupe-border pt-10">
      <div>
        <h2 className="text-lg font-bold text-fupe-text">Ingest match queue</h2>
        <p className="mt-1 text-sm text-fupe-muted">
          Low-confidence ETL dedupe candidates ({total} pending). Accept marks
          for merge review; reject dismisses the match.
        </p>
      </div>

      {error ? <p className="text-sm text-verdict-yes">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-fupe-muted">Loading…</p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-fupe-muted">No pending ingest matches.</p>
      ) : (
        <ul className="space-y-3">
          {matches.map((m) => (
            <li
              key={m.id}
              className="rounded-xl border border-fupe-border bg-fupe-surface px-4 py-4"
            >
              <p className="text-sm text-fupe-text">
                <span className="font-medium">{incomingName(m)}</span>
                {m.candidate_name ? (
                  <>
                    {' '}
                    ↔{' '}
                    <span className="font-medium">{m.candidate_name}</span>
                  </>
                ) : (
                  ' (no candidate)'
                )}
              </p>
              <p className="mt-1 text-xs text-fupe-muted">
                score {m.score.toFixed(2)} · {m.match_reason}
                {m.source_id ? ` · source ${m.source_id}` : ''}
              </p>
              <p className="mt-1 text-xs text-fupe-muted">
                {new Date(m.created_at).toLocaleString()}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => resolve(m.id, 'accepted')}
                  className="rounded-full bg-fupe-text px-3 py-1 text-xs font-semibold text-fupe-bg hover:bg-fupe-muted disabled:opacity-60"
                >
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => resolve(m.id, 'merged')}
                  className="rounded-full border border-fupe-border px-3 py-1 text-xs text-fupe-text hover:border-fupe-muted disabled:opacity-60"
                >
                  Mark merged
                </button>
                <button
                  type="button"
                  disabled={busyId === m.id}
                  onClick={() => resolve(m.id, 'rejected')}
                  className="rounded-full border border-fupe-border px-3 py-1 text-xs text-fupe-muted hover:text-fupe-text disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
