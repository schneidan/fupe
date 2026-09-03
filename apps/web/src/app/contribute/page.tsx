import { ContributeHub } from '@/components/ContributeHub';
import { FupeLogo } from '@/components/FupeLogo';

export const metadata = {
  title: 'Contribute',
};

export default function ContributePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="text-2xl font-bold text-fupe-text">Contribute</h1>
      <p className="mt-3 text-fupe-muted">
        Help fill gaps the ingest pipeline misses. Suggest ownership parents
        with a public citation — new accounts go to a review queue; high-trust
        editors auto-commit.
      </p>
      <ContributeHub />
    </main>
  );
}
