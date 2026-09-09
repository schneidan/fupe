import Link from 'next/link';
import { FupeLogo } from '@/components/FupeLogo';

/** Shared chrome for consumer content pages (About, FAQ, etc.). */
export function ContentDoc({
  title,
  deck,
  children,
}: {
  title: string;
  deck?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8">
        <FupeLogo size="nav" back />
      </div>
      <h1 className="text-2xl font-bold text-fupe-text">{title}</h1>
      {deck ? <p className="mt-2 text-fupe-muted">{deck}</p> : null}
      <div className="mt-8 space-y-5 text-sm leading-relaxed text-fupe-muted">
        {children}
      </div>
    </main>
  );
}

export function ContentH2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="pt-2 text-base font-semibold text-fupe-text">{children}</h2>
  );
}

export function ContentLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="text-fupe-text hover:underline">
      {children}
    </Link>
  );
}
