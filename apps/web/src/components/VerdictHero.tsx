'use client';

import Link from 'next/link';
import type { LookupResult } from '@/lib/api';
import { ShareEntityButton } from '@/components/ShareEntityButton';
import { entityPath } from '@/lib/slug';

interface VerdictHeroProps {
  result: LookupResult;
  weakEvidence?: boolean;
}

function formatUpdated(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function VerdictHero({ result, weakEvidence }: VerdictHeroProps) {
  const isYes = result.is_private_equity_owned;
  const updated = formatUpdated(result.updated_at);
  const shareText = isYes
    ? `${result.matched_item} is PE/VC-backed according to FUPE`
    : `${result.matched_item} — no PE/VC found in FUPE’s ownership chain`;

  return (
    <div className="text-center">
      <h1
        className={`font-black leading-none tracking-tight ${isYes ? 'text-7xl text-verdict-yes shadow-yes sm:text-8xl md:text-9xl' : 'text-7xl text-verdict-no shadow-no sm:text-8xl md:text-9xl'}`}
        style={{
          textShadow: isYes
            ? '0 0 80px rgba(239,68,68,0.45)'
            : '0 0 80px rgba(34,197,94,0.35)',
        }}
      >
        {isYes ? 'YES' : 'NO'}
      </h1>

      <p className="mt-double text-lg text-fupe-muted sm:text-xl">
        {isYes ? (
          <>
            <span className="font-semibold text-fupe-text">
              {result.matched_item}
            </span>{' '}
            is backed by Private Equity
            {result.ultimate_parent && (
              <>
                {' '}
                — ultimate parent:{' '}
                <Link
                  href={entityPath(
                    result.ultimate_parent.slug || result.ultimate_parent.name,
                  )}
                  className="text-verdict-yes underline-offset-2 hover:underline"
                >
                  {result.ultimate_parent.name}
                </Link>
              </>
            )}
          </>
        ) : (
          <>
            We found no PE/VC firm in the ownership chain for{' '}
            <span className="font-semibold text-fupe-text">
              {result.matched_item}
            </span>
            .
          </>
        )}
      </p>

      {weakEvidence ? (
        <p className="mx-auto mt-4 max-w-lg rounded-lg border border-status-warn/40 bg-status-warn/10 px-3 py-2 text-xs text-fupe-muted">
          Limited evidence for this chain — review the citations below before
          relying on this verdict.
        </p>
      ) : null}

      {isYes && (
        <p className="mx-auto mt-3 max-w-lg text-sm text-fupe-muted">
          Private equity ownership often means profit extraction over product
          quality, worker conditions, and consumer transparency.
        </p>
      )}
      <p className="mx-auto mt-4 max-w-lg text-xs text-fupe-muted">
        Informational only — not legal or financial advice.
        {updated ? <> Entity last updated {updated}.</> : null}
      </p>

      <div className="mt-6">
        <ShareEntityButton
          title={`${result.matched_item} — PE owned: ${isYes ? 'YES' : 'NO'} | FUPE`}
          text={shareText}
        />
      </div>
    </div>
  );
}
