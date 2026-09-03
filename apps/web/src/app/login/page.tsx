import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { FupeLogo } from '@/components/FupeLogo';

export const metadata = {
  title: 'Sign in',
};

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="mb-6 text-2xl font-bold text-fupe-text">Sign in</h1>
      <Suspense fallback={<p className="text-fupe-muted">Loading…</p>}>
        <AuthForm initialMode="login" />
      </Suspense>
    </main>
  );
}
