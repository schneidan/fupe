import Link from 'next/link';

export default function ContributePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <Link
        href="/"
        className="mb-8 inline-block text-sm text-fupe-muted hover:text-fupe-accent"
      >
        ← FUPE
      </Link>
      <h1 className="text-2xl font-bold text-fupe-text">Contribute</h1>
      <p className="mt-4 text-fupe-muted">
        Community edits (with citations) are supported via the API today. A
        contributor UI is on the roadmap — register an account and submit edits
        through{' '}
        <code className="rounded bg-fupe-elevated px-1 text-fupe-accent">
          POST /api/v1/edits
        </code>
        .
      </p>
      <p className="mt-4 text-sm text-fupe-muted">
        PE/VC ownership claims require a valid source URL. High-trust users
        auto-commit; others go to a moderation queue.
      </p>
    </main>
  );
}
