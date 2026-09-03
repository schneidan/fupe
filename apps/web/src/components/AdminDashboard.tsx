'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  fetchAdminAudit,
  fetchAdminStats,
  type AdminAuditEntry,
  type AdminStats,
} from '@/lib/admin-api';

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: number | undefined;
  href?: string;
}) {
  const inner = (
    <>
      <p className="text-xs font-semibold uppercase tracking-widest text-fupe-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-fupe-text">{value ?? '—'}</p>
    </>
  );
  const cls = 'rounded-xl border border-fupe-border bg-fupe-surface p-5';
  if (href) {
    return (
      <Link href={href} className={`${cls} transition hover:border-fupe-muted`}>
        {inner}
      </Link>
    );
  }
  return <div className={cls}>{inner}</div>;
}

const ACTION_LABEL: Record<string, string> = {
  user_update: 'User update',
  tier_override: 'Tier override',
  key_revoke: 'Key revoke',
  edit_review: 'Edit review',
  edit_reopen: 'Edit reopen',
  ingest_resolve: 'Ingest resolve',
};

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([fetchAdminStats(), fetchAdminAudit({ limit: 8 })])
      .then(([s, a]) => {
        setStats(s);
        setAudit(a.entries);
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Failed to load stats'),
      )
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return <p className="text-sm text-fupe-muted">Loading…</p>;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-fupe-border bg-fupe-surface p-6">
        <p className="text-sm text-verdict-yes">{error}</p>
        <Link href="/login?next=/admin" className="mt-4 inline-block text-sm text-fupe-text hover:underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-fupe-text">Dashboard</h1>
        <p className="mt-1 text-sm text-fupe-muted">Overview of FUPE&apos;s operational state.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatCard label="Pending edits" value={stats?.pending_edits} href="/admin/contributions" />
        <StatCard label="New users (7d)" value={stats?.new_users_7d} href="/admin/users" />
        <StatCard label="New users (24h)" value={stats?.new_users_24h} href="/admin/users" />
        <StatCard label="Paid subs" value={stats?.paid_subscribers} href="/admin/subscriptions" />
        <StatCard label="Ingest matches" value={stats?.pending_ingest_matches} href="/admin/contributions" />
        <StatCard label="Requests today" value={stats?.requests_today} href="/admin/usage" />
        <StatCard label="Active keys" value={stats?.total_api_keys} href="/admin/usage" />
        <StatCard label="Staff actions (7d)" value={stats?.audit_actions_7d} href="/admin/audit" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total users" value={stats?.total_users} href="/admin/users" />
        <StatCard label="Verified" value={stats?.verified_users} href="/admin/users" />
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-fupe-muted">
            Recent staff actions
          </h2>
          <Link href="/admin/audit" className="text-xs text-fupe-text hover:underline">
            Full audit log →
          </Link>
        </div>
        {audit.length === 0 ? (
          <p className="text-sm text-fupe-muted">No admin actions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-fupe-border rounded-xl border border-fupe-border text-sm">
            {audit.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 px-4 py-2.5">
                <span className="text-xs text-fupe-muted">
                  {new Date(e.created_at).toLocaleString()}
                </span>
                <span className="font-mono text-xs text-fupe-text">
                  {e.actor_email ?? '—'}
                </span>
                <span className="text-fupe-text">
                  {ACTION_LABEL[e.action] ?? e.action}
                </span>
                {e.note ? (
                  <span className="text-xs text-fupe-muted">{e.note}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { href: '/admin/users', label: 'Manage users', desc: 'Edit roles, trust, verification.' },
          { href: '/admin/contributions', label: 'Contributions', desc: 'Approve or reject pending edits.' },
          { href: '/admin/subscriptions', label: 'Subscriptions', desc: 'View and override billing tiers.' },
          { href: '/admin/usage', label: 'API usage', desc: "Today's requests, IMAGE blocks, rate-limit hits." },
          { href: '/admin/audit', label: 'Audit log', desc: 'Staff actions across the console.' },
        ].map(({ href, label, desc }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-fupe-border bg-fupe-surface p-5 transition hover:border-fupe-muted"
          >
            <h2 className="font-semibold text-fupe-text">{label}</h2>
            <p className="mt-1 text-sm text-fupe-muted">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
