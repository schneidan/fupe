'use client';

import { useEffect, useState } from 'react';
import { fetchAdminStats, type AdminStats } from '@/lib/admin-api';
import { getStoredUser } from '@/lib/auth';
import Link from 'next/link';

function StatCard({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-fupe-border bg-fupe-surface p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-fupe-muted">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-fupe-text">
        {value ?? '—'}
      </p>
    </div>
  );
}

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    if (!user) {
      setError('You must be signed in.');
      setReady(true);
      return;
    }
    if (user.role !== 'admin') {
      setError(`Admin role required. Your role: ${user.role}.`);
      setReady(true);
      return;
    }
    fetchAdminStats()
      .then(setStats)
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
        <p className="mt-1 text-sm text-fupe-muted">Overview of FUPE's operational state.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total users" value={stats?.total_users} />
        <StatCard label="Verified" value={stats?.verified_users} />
        <StatCard label="Paid subs" value={stats?.paid_subscribers} />
        <StatCard label="Pending edits" value={stats?.pending_edits} />
        <StatCard label="Active keys" value={stats?.total_api_keys} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: '/admin/users', label: 'Manage users', desc: 'Edit roles, trust, verification.' },
          { href: '/admin/contributions', label: 'Contributions', desc: 'Approve or reject pending edits.' },
          { href: '/admin/subscriptions', label: 'Subscriptions', desc: 'View and override billing tiers.' },
          { href: '/admin/usage', label: 'API usage', desc: "Today's requests per key." },
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
