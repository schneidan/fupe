interface Citation {
  title: string;
  url: string;
  retrieved_at?: string;
  stale?: boolean;
}

interface CitationsListProps {
  citations: Citation[];
}

export function CitationsList({ citations }: CitationsListProps) {
  if (!citations.length) {
    return (
      <section className="rounded-xl border border-fupe-border bg-fupe-surface p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-fupe-accent">
          Sources
        </h2>
        <p className="mt-2 text-sm text-fupe-muted">
          No citations on file yet. Know better?{' '}
          <a href="/contribute" className="text-fupe-accent hover:underline">
            Contribute a source
          </a>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-fupe-border bg-fupe-surface p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-fupe-accent">
        Sources &amp; citations
      </h2>
      <ul className="mt-3 space-y-2">
        {citations.map((c) => (
          <li key={c.url} className="text-sm">
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fupe-text underline-offset-2 hover:underline"
            >
              {c.title}
            </a>
            {c.stale ? (
              <span className="ml-2 text-fupe-muted">(may be outdated)</span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
