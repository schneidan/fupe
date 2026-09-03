import Link from 'next/link';
import { FupeLogo } from '@/components/FupeLogo';

export function LegalDoc({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="text-2xl font-bold text-fupe-text">{title}</h1>
      <p className="mt-2 text-xs text-fupe-muted">Last updated: September 3, 2026</p>
      <div className="prose-legal mt-8 space-y-5 text-sm leading-relaxed text-fupe-muted">
        {children}
      </div>
      <p className="mt-10 text-sm text-fupe-muted">
        <Link href="/legal" className="text-fupe-text hover:underline">
          ← All legal documents
        </Link>
      </p>
    </main>
  );
}

export function LegalH2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-fupe-text">{children}</h2>;
}
