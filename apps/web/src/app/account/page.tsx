import Link from 'next/link';
import { AccountHub } from '@/components/AccountHub';
import { FupeLogo } from '@/components/FupeLogo';

export const metadata = {
  title: 'Account',
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="text-2xl font-bold text-fupe-text">Account</h1>
      <p className="mt-3 text-fupe-muted">
        Your profile, preferences, and contribution history. Contribution tools
        live on{' '}
        <Link href="/contribute" className="text-fupe-text hover:underline">
          Contribute
        </Link>
        .
      </p>
      <AccountHub />
    </main>
  );
}
