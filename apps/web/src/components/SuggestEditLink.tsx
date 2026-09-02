'use client';

import Link from 'next/link';

export function SuggestEditLink({
  entityId,
  name,
}: {
  entityId?: string;
  name: string;
}) {
  if (!entityId) {
    return (
      <p className="text-center text-sm text-fupe-muted">
        Spot an error?{' '}
        <Link href="/contribute" className="text-fupe-text hover:underline">
          Contribute
        </Link>
      </p>
    );
  }

  const href = `/contribute/suggest?entity_id=${encodeURIComponent(entityId)}&name=${encodeURIComponent(name)}`;

  return (
    <div className="text-center">
      <Link
        href={href}
        className="inline-block rounded-full border border-fupe-border px-5 py-2 text-sm text-fupe-text transition hover:border-fupe-muted hover:bg-fupe-surface"
      >
        Suggest an edit
      </Link>
      <p className="mt-2 text-xs text-fupe-muted">
        Propose a parent / ownership change with a citation
      </p>
    </div>
  );
}
