'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getStoredUser, type AuthUser } from '@/lib/auth';
import { AdminNav } from '@/components/AdminNav';

function isAdmin(user: AuthUser | null): boolean {
  return user?.role === 'admin';
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const isLogin = pathname === '/admin/login';

  useEffect(() => {
    const sync = () => setUser(getStoredUser());
    sync();
    setReady(true);
    window.addEventListener('fupe-auth', sync);
    return () => window.removeEventListener('fupe-auth', sync);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (isLogin) {
      if (isAdmin(user)) {
        const next = searchParams.get('next') || '/admin';
        const safe =
          next.startsWith('/admin') && !next.startsWith('/admin/login')
            ? next
            : '/admin';
        router.replace(safe);
      }
      return;
    }
    if (!isAdmin(user)) {
      const next = encodeURIComponent(pathname || '/admin');
      router.replace(`/admin/login?next=${next}`);
    }
  }, [ready, user, isLogin, pathname, router, searchParams]);

  if (!ready) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-fupe-muted">
        Loading…
      </div>
    );
  }

  if (isLogin || !isAdmin(user)) {
    return <>{isLogin ? children : null}</>;
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)]">
      <div className="sticky top-0 h-screen w-52 shrink-0 border-r border-fupe-border bg-fupe-bg px-4 py-8">
        <AdminNav />
      </div>
      <div className="flex-1 overflow-auto px-8 py-8">{children}</div>
    </div>
  );
}
