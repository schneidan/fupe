'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStoredUser, type AuthUser } from '@/lib/auth';

export function SiteAccountLink() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    sync();
    window.addEventListener('fupe-auth', sync);
    return () => window.removeEventListener('fupe-auth', sync);
  }, []);

  if (pathname.startsWith('/admin') || pathname === '/login' || pathname === '/register') {
    return null;
  }

  if (!user) {
    return (
      <Link
        href={`/login?next=${encodeURIComponent(pathname || '/')}`}
        className="fixed right-4 top-4 z-50 text-xs text-fupe-muted transition hover:text-fupe-text"
      >
        Sign in
      </Link>
    );
  }

  const label = user.email.includes('@')
    ? user.email.split('@')[0]
    : user.email;

  return (
    <div className="fixed right-4 top-4 z-50 flex items-center gap-3 text-xs">
      {user.role === 'admin' ? (
        <Link href="/admin" className="text-fupe-muted hover:text-fupe-text">
          Admin
        </Link>
      ) : null}
      <Link
        href="/contribute"
        className="max-w-[10rem] truncate text-fupe-muted hover:text-fupe-text"
        title={user.email}
      >
        {label}
      </Link>
    </div>
  );
}
