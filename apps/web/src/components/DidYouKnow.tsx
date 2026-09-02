'use client';

import type { LookupResult } from '@/lib/api';

interface DidYouKnowProps {
  result: LookupResult;
}

/**
 * Placeholder for Phase 2 related-entities API.
 * Shows contextual copy based on verdict until /entities/:id/related ships.
 */
export function DidYouKnow({ result }: DidYouKnowProps) {
  const peParent = result.ultimate_parent;
  const isPe = result.is_private_equity_owned;

  if (!isPe || !peParent) {
    return (
      <section className="rounded-xl border border-fupe-border border-dashed bg-fupe-surface/50 p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-fupe-accent">
          Did you know?
        </h2>
        <p className="mt-2 text-sm text-fupe-muted">
          Most household brands are owned by a handful of megacorporations — and
          an increasing share are PE portfolio companies.{' '}
          <a href="/browse" className="text-fupe-accent hover:underline">
            Browse the directory
          </a>{' '}
          to explore who owns what.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-verdict-yes/30 bg-verdict-yesGlow/20 p-6">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-verdict-yes">
        Did you know?
      </h2>
      <p className="mt-2 text-sm text-fupe-text">
        <span className="font-semibold text-fupe-text">
          {result.matched_item}
        </span>{' '}
        sits under{' '}
        <span className="font-semibold text-verdict-yes">
          {peParent.name}
        </span>
        , a {peParent.type.replace('_', ' ').toLowerCase()}. That firm likely
        holds other brands in its portfolio too — same playbook, different label.
      </p>
      <p className="mt-2 text-xs text-fupe-muted">
        Related brands from the same parent coming soon in the directory.
      </p>
    </section>
  );
}
