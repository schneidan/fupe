import Link from 'next/link';

export default function BrowsePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16 text-center">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← FUPE
      </Link>
      <h1 className="text-2xl font-bold text-fupe-text">
        Browse directory
      </h1>
      <p className="mt-4 text-fupe-muted">
        Searchable A–Z entity directory is coming in the next release. For now,
        use the home page to look up any brand or company.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block rounded-full bg-fupe-text px-6 py-2 text-sm font-semibold text-fupe-bg hover:bg-fupe-accent"
      >
        Is it owned by PE?
      </Link>
    </main>
  );
}
