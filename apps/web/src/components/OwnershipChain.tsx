import type { ChainNode } from '@/lib/api';

interface OwnershipChainProps {
  chain: ChainNode[];
}

export function OwnershipChain({ chain }: OwnershipChainProps) {
  if (!chain.length) return null;

  return (
    <section className="rounded-xl border border-fupe-border bg-fupe-surface p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-fupe-accent">
        Ownership chain
      </h2>
      <ol className="mt-4 space-y-3">
        {chain.map((node, i) => {
          const isPe =
            node.type === 'PE_FIRM' || node.type === 'VC_FIRM';
          return (
            <li key={`${node.name}-${i}`} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fupe-elevated text-xs font-bold text-fupe-muted">
                {i + 1}
              </span>
              <div>
                <span
                  className={`font-medium ${isPe ? 'text-verdict-yes' : 'text-fupe-text'}`}
                >
                  {node.name}
                </span>
                <span className="ml-2 text-sm text-fupe-muted">
                  ({node.type})
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
