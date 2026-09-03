import type { LookupResult } from '@/lib/api';

interface VerdictHeroProps {
  result: LookupResult;
}

export function VerdictHero({ result }: VerdictHeroProps) {
  const isYes = result.is_private_equity_owned;

  return (
    <div className="text-center">
      <p
        className={`font-black leading-none tracking-tight ${isYes ? 'text-7xl text-verdict-yes shadow-yes sm:text-8xl md:text-9xl' : 'text-7xl text-verdict-no shadow-no sm:text-8xl md:text-9xl'}`}
        style={{ textShadow: isYes ? '0 0 80px rgba(239,68,68,0.45)' : '0 0 80px rgba(34,197,94,0.35)' }}
      >
        {isYes ? 'YES' : 'NO'}
      </p>

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
                <span className="text-verdict-yes">
                  {result.ultimate_parent.name}
                </span>
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

      {isYes && (
        <p className="mx-auto mt-3 max-w-lg text-sm text-fupe-muted">
          Private equity ownership often means profit extraction over product
          quality, worker conditions, and consumer transparency.
        </p>
      )}
      <p className="mx-auto mt-4 max-w-lg text-xs text-fupe-muted">
        Informational only — not legal or financial advice.
      </p>
    </div>
  );
}
