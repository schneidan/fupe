import { FupeLogo } from '@/components/FupeLogo';
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';

export const metadata = {
  title: 'Forgot password',
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="mb-6 text-2xl font-bold text-fupe-text">Forgot password</h1>
      <ForgotPasswordForm />
    </main>
  );
}
