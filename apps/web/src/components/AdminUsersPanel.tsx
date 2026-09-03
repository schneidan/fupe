'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchAdminUsers,
  patchAdminUser,
  type AdminUser,
} from '@/lib/admin-api';

const ROLES = ['user', 'moderator', 'admin'] as const;

function Badge({ text, variant }: { text: string; variant?: 'warn' | 'ok' | 'muted' }) {
  const cls =
    variant === 'warn'
      ? 'bg-verdict-yes/20 text-verdict-yes'
      : variant === 'ok'
        ? 'bg-verdict-no/20 text-verdict-no'
        : 'bg-fupe-elevated text-fupe-muted';
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>{text}</span>
  );
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers({ q: q || undefined, role: roleFilter || undefined, page });
      setUsers(res.users);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter, page]);

  useEffect(() => { load(); }, [load]);

  async function patch(id: string, patch: Parameters<typeof patchAdminUser>[1]) {
    setBusy(id);
    try {
      const updated = await patchAdminUser(id, patch);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  const LIMIT = 50;
  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-fupe-text">Users</h1>
        <p className="mt-1 text-sm text-fupe-muted">{total} total</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search email…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setPage(1); }}
          className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-text outline-none placeholder:text-fupe-muted focus:border-fupe-muted"
        />
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-text outline-none"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <button
          onClick={load}
          className="rounded-lg border border-fupe-border px-3 py-2 text-sm text-fupe-text hover:border-fupe-muted"
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-verdict-yes">{error}</p>}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-fupe-border">
        <table className="w-full text-sm">
          <thead className="border-b border-fupe-border bg-fupe-elevated text-xs font-semibold uppercase tracking-wider text-fupe-muted">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Trust</th>
              <th className="px-4 py-3 text-left">Verified</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-left">Keys</th>
              <th className="px-4 py-3 text-left">Pending edits</th>
              <th className="px-4 py-3 text-left">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-fupe-border">
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-fupe-muted">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-fupe-muted">No users found.</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-fupe-elevated/40">
                <td className="px-4 py-3 font-mono text-xs text-fupe-text">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    disabled={busy === u.id}
                    onChange={(e) => patch(u.id, { role: e.target.value as AdminUser['role'] })}
                    className="rounded border border-fupe-border bg-fupe-bg px-1.5 py-0.5 text-xs text-fupe-text"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={u.trust_score}
                    disabled={busy === u.id}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== u.trust_score) patch(u.id, { trust_score: v });
                    }}
                    className="w-16 rounded border border-fupe-border bg-fupe-bg px-1.5 py-0.5 text-xs text-fupe-text"
                  />
                </td>
                <td className="px-4 py-3">
                  {u.email_verified_at ? (
                    <Badge text="✓ verified" variant="ok" />
                  ) : (
                    <button
                      onClick={() => patch(u.id, { email_verified: true })}
                      disabled={busy === u.id}
                      className="text-xs text-fupe-muted hover:text-fupe-text"
                    >
                      Force verify
                    </button>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Badge
                    text={u.subscription_tier}
                    variant={u.subscription_tier !== 'free' ? 'ok' : 'muted'}
                  />
                </td>
                <td className="px-4 py-3 text-center text-fupe-muted">{u.api_key_count}</td>
                <td className="px-4 py-3 text-center">
                  {u.pending_edit_count > 0 ? (
                    <Badge text={String(u.pending_edit_count)} variant="warn" />
                  ) : (
                    <span className="text-fupe-muted">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-fupe-muted">
                  {new Date(u.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center gap-3 text-sm text-fupe-muted">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded border border-fupe-border px-3 py-1 hover:text-fupe-text disabled:opacity-40"
          >
            ←
          </button>
          <span>Page {page} of {pages}</span>
          <button
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
