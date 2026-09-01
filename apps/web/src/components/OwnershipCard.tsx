import type { ChainNode } from '@/lib/api';

interface OwnershipCardProps {
  result: {
    matched_item: string;
    is_private_equity_owned: boolean;
    ultimate_parent: ChainNode | null;
    ownership_chain: ChainNode[];
    citations: Array<{ title: string; url: string }>;
  };
}

export function OwnershipCard({ result }: OwnershipCardProps) {
  const { matched_item, is_private_equity_owned, ownership_chain, citations } =
    result;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            {matched_item}
          </h2>
          {result.ultimate_parent && (
            <p className="mt-0.5 text-sm text-slate-500">
              Ultimate parent: {result.ultimate_parent.name} (
              {result.ultimate_parent.type})
            </p>
          )}
        </div>
        {is_private_equity_owned && (
          <span className="shrink-0 rounded-full bg-pe-bg px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pe-flag">
            PE / VC Backed
          </span>
        )}
      </div>

      {ownership_chain.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Ownership chain
          </p>
          <ol className="mt-2 space-y-1">
            {ownership_chain.map((node, i) => (
              <li key={`${node.name}-${i}`} className="flex items-center gap-2 text-sm">
                <span className="text-slate-300">{i + 1}.</span>
                <span className="text-slate-700">{node.name}</span>
                <span className="text-slate-400">({node.type})</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {citations.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Citations
          </p>
          <ul className="mt-1 space-y-1">
            {citations.map((c) => (
              <li key={c.url}>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-fupe-600 hover:underline"
                >
                  {c.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
