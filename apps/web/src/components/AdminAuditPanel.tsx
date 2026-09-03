'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  fetchAdminAudit,
  type AdminAuditEntry,
} from '@/lib/admin-api';

const ACTIONS = [
  '',
  'user_update',
  'tier_override',
  'key_revoke',
  'edit_review',
  'edit_reopen',
  'ingest_resolve',
] as const;

const ACTION_LABEL: Record<string, string> = {
  user_update: 'User update',
  tier_override: 'Tier override',
  key_revoke: 'Key revoke',
  edit_review: 'Edit review',
  edit_reopen: 'Edit reopen',
  ingest_resolve: 'Ingest resolve',
};

function summarize(e: AdminAuditEntry): string {
  const prev = e.previous_state ?? {};
  const next = e.new_state ?? {};
  switch (e.action) {
    case 'tier_override':
      return `${String(prev.subscription_tier ?? '?')} → ${String(next.subscription_tier ?? '?')}`;
    case 'user_update': {
      const bits: string[] = [];
      if (prev.role !== next.role) bits.push(`role ${String(prev.role)} → ${String(next.role)}`);
      if (prev.trust_score !== next.trust_score) {
        bits.push(`trust ${String(prev.trust_score)} → ${String(next.trust_score)}`);
      }
      if (prev.email_verified !== next.email_verified) {
        bits.push(next.email_verified ? 'verified' : 'unverified');
      }
      if (prev.disabled !== next.disabled) {
        bits.push(next.disabled ? 'disabled' : 're-enabled');
      }
      return bits.join(', ') || 'updated';
    }
    case 'key_revoke':
      return `revoked ${String(next.key_prefix ?? e.target_id).slice(0, 16)}`;
    case 'edit_review':
      return `${String(prev.status)} → ${String(next.status)}`;
    case 'edit_reopen':
      return 'REJECTED → PENDING';
    case 'ingest_resolve':
      return `${String(prev.status)} → ${String(next.status)}`;
    default:
      return e.action;
  }
}

export function AdminAuditPanel() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminAudit({
        action: action || undefined,
        page,
        limit: LIMIT,
      });
      setEntries(res.entries);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [action, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fupe-text">Audit log</h1>
        <p className="mt-1 text-sm text-fupe-muted">
          {total} staff actions · users, billing, keys, contributions, ingest.
        </p>
      </div>

      <label className="text-sm text-fupe-muted">
        Action
        <select
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
          className="ml-2 rounded border border-fupe-border bg-fupe-bg px-2 py-1 text-sm text-fupe-text"
        >
          <option value="">All</option>
          {ACTIONS.filter(Boolean).map((a) => (
            <option key={a} value={a}>
              {ACTION_LABEL[a] ?? a}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="text-sm text-verdict-yes">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-fupe-border">
        <table className="w-full text-sm">
          <thead className="border-b border-fupe-border bg-fupe-elevated text-xs font-semibold uppercase tracking-wider text-fupe-muted">
            <tr>
              <th className="px-4 py-3 text-left">When</th>
              <th className="px-4 py-3 text-left">Actor</th>
              <th className="px-4 py-3 text-left">Action</th>
              <th className="px-4 py-3 text-left">Summary</th>
              <th className="px-4 py-3 text-left">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fupe-border">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-fupe-muted">
                  Loading…
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-fupe-muted">
                  No audit entries yet.
                </td>
              </tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className="hover:bg-fupe-elevated/40">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-fupe-muted">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-fupe-text">
                    {e.actor_email ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-fupe-text">
                    {ACTION_LABEL[e.action] ?? e.action}
                  </td>
                  <td className="px-4 py-3 text-xs text-fupe-muted">
                    {summarize(e)}
                    <span className="ml-2 font-mono opacity-60">
                      {e.target_type}:{e.target_id.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-fupe-muted">{e.note ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
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
      )}
    </div>
  );
}
