interface Citation {
  title: string;
  url: string;
  retrieved_at?: string;
  stale?: boolean;
}

interface CitationsListProps {
  citations: Citation[];
}

export function isWeakEvidence(citations: Citation[]): boolean {
  if (citations.length === 0) return true;
  if (citations.length === 1) return true;
  if (citations.every((c) => c.stale)) return true;
  return false;
}

function formatRetrieved(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    // Allow bare YYYY-MM-DD from some sources
    if (/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso.slice(0, 10);
    return null;
  }
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CitationsList({ citations }: CitationsListProps) {
  const weak = isWeakEvidence(citations);

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
        <p className="mt-3 rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-xs text-fupe-muted">
          Low confidence — treat this result as incomplete until sources are
          added.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-fupe-border bg-fupe-surface p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-fupe-accent">
        Sources &amp; citations
      </h2>
      {weak ? (
        <p className="mt-3 rounded-lg border border-fupe-border bg-fupe-bg px-3 py-2 text-xs text-fupe-muted">
          {citations.length === 1
            ? 'Limited evidence — only one citation supports this chain. Confirm with primary sources before relying on it.'
            : 'Limited evidence — available citations may be outdated. Confirm with primary sources before relying on it.'}
        </p>
      ) : null}
      <ul className="mt-3 space-y-3">
        {citations.map((c) => {
          const retrieved = formatRetrieved(c.retrieved_at);
          return (
            <li key={c.url} className="text-sm">
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-fupe-text underline-offset-2 hover:underline"
              >
                {c.title}
              </a>
              <div className="mt-0.5 text-xs text-fupe-muted">
                {retrieved ? <>Retrieved {retrieved}</> : null}
                {retrieved && c.stale ? ' · ' : null}
                {c.stale ? <span>(may be outdated)</span> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
