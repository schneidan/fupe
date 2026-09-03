import { Suspense } from 'react';
import { FupeLogo } from '@/components/FupeLogo';
import { AuthForm } from '@/components/AuthForm';

export const metadata = { title: 'Sign in' };

export default function AdminLoginPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <div className="mb-8">
        <FupeLogo size="nav" href="/" />
        <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-fupe-muted">
          Admin
        </p>
      </div>
      <h1 className="mb-2 text-2xl font-bold text-fupe-text">Staff sign in</h1>
      <p className="mb-6 text-sm text-fupe-muted">
        Admin console access requires an account with the admin role.
      </p>
      <Suspense fallback={<p className="text-fupe-muted">Loading…</p>}>
        <AuthForm initialMode="login" />
      </Suspense>
    </main>
  );
}
