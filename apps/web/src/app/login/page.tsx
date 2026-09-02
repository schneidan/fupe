import { Suspense } from 'react';
import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';

export const metadata = {
  title: 'Sign in',
};

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← FUPE
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-fupe-text">Sign in</h1>
      <Suspense fallback={<p className="text-fupe-muted">Loading…</p>}>
        <AuthForm initialMode="login" />
      </Suspense>
    </main>
  );
}
