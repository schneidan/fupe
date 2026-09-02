import { Suspense } from 'react';
import Link from 'next/link';
import { AuthForm } from '@/components/AuthForm';

export const metadata = {
  title: 'Create account',
};

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← FUPE
      </Link>
      <h1 className="mb-6 text-2xl font-bold text-fupe-text">Create account</h1>
      <Suspense fallback={<p className="text-fupe-muted">Loading…</p>}>
        <AuthForm initialMode="register" />
      </Suspense>
    </main>
  );
}
