import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-fupe-border px-4 py-6 text-center text-sm text-fupe-muted">
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link href="/browse" className="text-fupe-text transition hover:text-fupe-muted">
          Browse
        </Link>
        <Link href="/contribute" className="text-fupe-text transition hover:text-fupe-muted">
          Contribute
        </Link>
        <Link href="/developers" className="text-fupe-text transition hover:text-fupe-muted">
          Developers
        </Link>
        <Link href="/legal" className="text-fupe-text transition hover:text-fupe-muted">
          Legal
        </Link>
        <Link href="/legal/privacy" className="text-fupe-text transition hover:text-fupe-muted">
          Privacy
        </Link>
        <Link href="/legal/terms" className="text-fupe-text transition hover:text-fupe-muted">
          Terms
        </Link>
      </nav>
      <p className="mx-auto mt-4 max-w-2xl text-xs leading-relaxed">
        Ownership data is sourced from public records &amp; community edits.
        Not legal or financial advice. Results may be incomplete — check{' '}
        <Link href="/legal/sources" className="text-fupe-text hover:underline">
          sources
        </Link>
        .
      </p>
    </footer>
  );
}
