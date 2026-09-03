'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FupeLogo } from '@/components/FupeLogo';

const NAV = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/contributions', label: 'Contributions' },
  { href: '/admin/subscriptions', label: 'Subscriptions' },
  { href: '/admin/usage', label: 'API usage' },
  { href: '/admin/audit', label: 'Audit' },
];

export function AdminNav() {
  const path = usePathname();

  return (
    <aside className="w-48 shrink-0">
      <div className="mb-6">
        <FupeLogo size="nav" href="/" />
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-fupe-muted">
          Admin
        </p>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ href, label, exact }) => {
          const active = exact ? path === href : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`rounded-lg px-3 py-2 text-sm transition ${
                active
                  ? 'bg-fupe-elevated font-semibold text-fupe-text'
                  : 'text-fupe-muted hover:bg-fupe-elevated hover:text-fupe-text'
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-8 border-t border-fupe-border pt-4">
        <Link
          href="/contribute"
          className="text-xs text-fupe-muted hover:text-fupe-text"
        >
          ← Contribute
        </Link>
      </div>
    </aside>
  );
}
