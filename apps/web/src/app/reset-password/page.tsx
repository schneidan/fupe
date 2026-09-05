import { Suspense } from 'react';
import { FupeLogo } from '@/components/FupeLogo';
import { ResetPasswordForm } from '@/components/ResetPasswordForm';

export const metadata = {
  title: 'Reset password',
};

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="mb-6 text-2xl font-bold text-fupe-text">Reset password</h1>
      <Suspense fallback={<p className="text-fupe-muted">Loading…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
