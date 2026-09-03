'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  fetchAdminUsers,
  fetchUserKeys,
  patchAdminUser,
  revokeKeyAdmin,
  type AdminUser,
  type AdminUserKey,
  type AdminUserPatch,
} from '@/lib/admin-api';
import { getStoredUser } from '@/lib/auth';

const ROLES = ['user', 'moderator', 'admin'] as const;

function Badge({
  text,
  variant,
}: {
  text: string;
  variant?: 'warn' | 'ok' | 'muted';
}) {
  const cls =
    variant === 'warn'
      ? 'bg-verdict-yes/20 text-verdict-yes'
      : variant === 'ok'
        ? 'bg-verdict-no/20 text-verdict-no'
        : 'bg-fupe-elevated text-fupe-muted';
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cls}`}>
      {text}
    </span>
  );
}

export function AdminUsersPanel() {
  const me = getStoredUser();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [disabledFilter, setDisabledFilter] = useState<'all' | 'active' | 'disabled'>(
    'active',
  );
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [keys, setKeys] = useState<AdminUserKey[]>([]);
  const [keysLoading, setKeysLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminUsers({
        q: q || undefined,
        role: roleFilter || undefined,
        disabled:
          disabledFilter === 'all'
            ? undefined
            : disabledFilter === 'disabled',
        page,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter, disabledFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  async function openDetail(u: AdminUser) {
    setSelected(u);
    setKeys([]);
    setKeysLoading(true);
    try {
      const res = await fetchUserKeys(u.id);
      setKeys(res.keys);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load keys');
    } finally {
      setKeysLoading(false);
    }
  }

  async function patch(id: string, patch: AdminUserPatch) {
    setBusy(id);
    setError(null);
    try {
      const updated = await patchAdminUser(id, patch);
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
      setSelected((prev) => (prev?.id === id ? { ...prev, ...updated } : prev));
      if (patch.disabled !== undefined) await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(null);
    }
  }

  async function revoke(keyId: string) {
    setBusy(keyId);
    try {
      await revokeKeyAdmin(keyId);
      if (selected) {
        const res = await fetchUserKeys(selected.id);
        setKeys(res.keys);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selected.id
              ? {
                  ...u,
                  api_key_count: res.keys.filter((k) => !k.revoked_at).length,
                }
              : u,
          ),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed');
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
        <p className="mt-1 text-sm text-fupe-muted">{total} matching</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          placeholder="Search email…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-text outline-none placeholder:text-fupe-muted focus:border-fupe-muted"
        />
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-text outline-none"
        >
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={disabledFilter}
          onChange={(e) => {
            setDisabledFilter(e.target.value as typeof disabledFilter);
            setPage(1);
          }}
          className="rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-sm text-fupe-text outline-none"
        >
          <option value="active">Active only</option>
          <option value="disabled">Disabled only</option>
          <option value="all">All</option>
        </select>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-fupe-border px-3 py-2 text-sm text-fupe-text hover:border-fupe-muted"
        >
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-verdict-yes">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-fupe-border">
        <table className="w-full text-sm">
          <thead className="border-b border-fupe-border bg-fupe-elevated text-xs font-semibold uppercase tracking-wider text-fupe-muted">
            <tr>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Trust</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Tier</th>
              <th className="px-4 py-3 text-left">Keys</th>
              <th className="px-4 py-3 text-left">Joined</th>
              <th className="px-4 py-3 text-left" />
            </tr>
          </thead>
          <tbody className="divide-y divide-fupe-border">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-fupe-muted">
                  Loading…
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-fupe-muted">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className={`hover:bg-fupe-elevated/40 ${u.disabled_at ? 'opacity-60' : ''}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-fupe-text">
                    {u.email}
                    {me?.id === u.id ? (
                      <span className="ml-2 text-fupe-muted">(you)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={busy === u.id}
                      onChange={(e) =>
                        patch(u.id, { role: e.target.value as AdminUser['role'] })
                      }
                      className="rounded border border-fupe-border bg-fupe-bg px-1.5 py-0.5 text-xs text-fupe-text"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={u.trust_score}
                      key={`${u.id}-${u.trust_score}`}
                      disabled={busy === u.id}
                      onBlur={(e) => {
                        const v = Number(e.target.value);
                        if (v !== u.trust_score) patch(u.id, { trust_score: v });
                      }}
                      className="w-16 rounded border border-fupe-border bg-fupe-bg px-1.5 py-0.5 text-xs text-fupe-text"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {u.disabled_at ? (
                      <Badge text="disabled" variant="warn" />
                    ) : u.email_verified_at ? (
                      <Badge text="verified" variant="ok" />
                    ) : (
                      <Badge text="unverified" variant="muted" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      text={u.subscription_tier}
                      variant={u.subscription_tier !== 'free' ? 'ok' : 'muted'}
                    />
                  </td>
                  <td className="px-4 py-3 text-center text-fupe-muted">
                    {u.api_key_count}
                  </td>
                  <td className="px-4 py-3 text-xs text-fupe-muted">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openDetail(u)}
                      className="text-xs text-fupe-text underline-offset-2 hover:underline"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

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

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/50"
          onClick={() => setSelected(null)}
        >
          <aside
            className="h-full w-full max-w-md overflow-y-auto border-l border-fupe-border bg-fupe-bg p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-fupe-text">User detail</h2>
                <p className="mt-1 break-all font-mono text-xs text-fupe-muted">
                  {selected.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-sm text-fupe-muted hover:text-fupe-text"
              >
                Close
              </button>
            </div>

            <dl className="mb-6 space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-fupe-muted">Role</dt>
                <dd className="text-fupe-text">{selected.role}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fupe-muted">Trust</dt>
                <dd className="text-fupe-text">{selected.trust_score}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fupe-muted">Pending edits</dt>
                <dd className="text-fupe-text">{selected.pending_edit_count}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-fupe-muted">Joined</dt>
                <dd className="text-fupe-text">
                  {new Date(selected.created_at).toLocaleString()}
                </dd>
              </div>
            </dl>

            <div className="mb-8 flex flex-wrap gap-2">
              {selected.email_verified_at ? (
                <button
                  type="button"
                  disabled={busy === selected.id}
                  onClick={() => patch(selected.id, { email_verified: false })}
                  className="rounded-full border border-fupe-border px-3 py-1.5 text-xs text-fupe-text hover:border-fupe-muted"
                >
                  Unverify email
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy === selected.id}
                  onClick={() => patch(selected.id, { email_verified: true })}
                  className="rounded-full border border-fupe-border px-3 py-1.5 text-xs text-fupe-text hover:border-fupe-muted"
                >
                  Force verify
                </button>
              )}
              {selected.disabled_at ? (
                <button
                  type="button"
                  disabled={busy === selected.id}
                  onClick={() => patch(selected.id, { disabled: false })}
                  className="rounded-full bg-fupe-text px-3 py-1.5 text-xs font-semibold text-fupe-bg hover:bg-fupe-muted"
                >
                  Re-enable account
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy === selected.id || me?.id === selected.id}
                  onClick={() => {
                    if (
                      confirm(
                        `Disable ${selected.email}? They will be signed out and active API keys revoked.`,
                      )
                    ) {
                      patch(selected.id, { disabled: true });
                    }
                  }}
                  className="rounded-full border border-verdict-yes/40 px-3 py-1.5 text-xs text-verdict-yes hover:bg-verdict-yes/10 disabled:opacity-40"
                >
                  Disable account
                </button>
              )}
            </div>

            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-fupe-muted">
              API keys
            </h3>
            {keysLoading ? (
              <p className="text-sm text-fupe-muted">Loading keys…</p>
            ) : keys.length === 0 ? (
              <p className="text-sm text-fupe-muted">No API keys.</p>
            ) : (
              <ul className="space-y-3">
                {keys.map((k) => (
                  <li
                    key={k.id}
                    className="rounded-lg border border-fupe-border bg-fupe-surface p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-fupe-text">{k.name}</p>
                        <p className="font-mono text-xs text-fupe-muted">
                          {k.key_prefix}…
                        </p>
                        <p className="mt-1 text-xs text-fupe-muted">
                          {k.tier} · {k.usage_today} today
                          {k.revoked_at ? ' · revoked' : ''}
                        </p>
                      </div>
                      {!k.revoked_at ? (
                        <button
                          type="button"
                          disabled={busy === k.id}
                          onClick={() => revoke(k.id)}
                          className="shrink-0 text-xs text-verdict-yes hover:underline disabled:opacity-40"
                        >
                          Revoke
                        </button>
                      ) : (
                        <Badge text="revoked" variant="muted" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
