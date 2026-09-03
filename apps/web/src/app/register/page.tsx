import { Suspense } from 'react';
import { AuthForm } from '@/components/AuthForm';
import { FupeLogo } from '@/components/FupeLogo';

export const metadata = {
  title: 'Create account',
};

export default function RegisterPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="mb-6 text-2xl font-bold text-fupe-text">Create account</h1>
      <Suspense fallback={<p className="text-fupe-muted">Loading…</p>}>
        <AuthForm initialMode="register" />
      </Suspense>
    </main>
  );
}
