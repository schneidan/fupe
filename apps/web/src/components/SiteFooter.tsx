import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-fupe-border px-4 py-6 text-center text-sm text-fupe-muted">
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Link
          href="/browse"
          className="text-fupe-text transition hover:text-fupe-muted"
        >
          Browse directory
        </Link>
        <span className="hidden text-fupe-border sm:inline">|</span>
        <Link
          href="/contribute"
          className="text-fupe-text transition hover:text-fupe-muted"
        >
          Contribute
        </Link>
        <span className="hidden text-fupe-border sm:inline">|</span>
        <span>
          Ownership data is sourced from public records &amp; community edits.
          Not legal or financial advice.
        </span>
      </nav>
    </footer>
  );
}
