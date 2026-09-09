import Link from 'next/link';
import type { ChainNode } from '@/lib/api';
import { entityPath } from '@/lib/slug';

interface OwnershipChainProps {
  chain: ChainNode[];
  /** Slug of the current entity page — that node stays plain text */
  currentSlug?: string;
}

export function OwnershipChain({ chain, currentSlug }: OwnershipChainProps) {
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
          const href =
            node.type === 'PRODUCT'
              ? null
              : entityPath(node.slug || node.name);
          const isCurrent =
            Boolean(currentSlug) &&
            Boolean(href) &&
            href === entityPath(currentSlug!);

          const nameClass = `font-medium ${isPe ? 'text-verdict-yes' : 'text-fupe-text'}`;

          return (
            <li key={`${node.name}-${i}`} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fupe-elevated text-xs font-bold text-fupe-muted">
                {i + 1}
              </span>
              <div>
                {href && !isCurrent ? (
                  <Link
                    href={href}
                    className={`${nameClass} underline-offset-2 hover:underline`}
                  >
                    {node.name}
                  </Link>
                ) : (
                  <span className={nameClass}>{node.name}</span>
                )}
                <span className="ml-2 text-sm text-fupe-muted">
                  ({node.type.replace(/_/g, ' ')})
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
