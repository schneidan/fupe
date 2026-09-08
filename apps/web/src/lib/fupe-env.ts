/**
 * Deploy / local environment for UI cues (favicon slash, etc.).
 *
 * Set NEXT_PUBLIC_FUPE_ENV in apps/web/.env* (baked at Next build):
 *   development | staging | production
 *
 * Local `next dev` defaults to development (red slash) when unset.
 * Staging/prod builds should set it explicitly in .env.production.
 */
export type FupeEnv = 'development' | 'staging' | 'production';

export function resolveFupeEnv(
  raw:
    | string
    | undefined = process.env.NEXT_PUBLIC_FUPE_ENV ?? process.env.FUPE_ENV,
): FupeEnv {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'dev' || v === 'development' || v === 'local') return 'development';
  if (v === 'staging' || v === 'stage') return 'staging';
  if (v === 'production' || v === 'prod') return 'production';

  // Sensible default for local next dev without an env file.
  if (process.env.NODE_ENV === 'development') return 'development';
  return 'production';
}

/** Diagonal slash color for favicon; null = leave mark alone (prod). */
export function faviconSlashColor(env: FupeEnv): string | null {
  if (env === 'development') return '#ef4444';
  if (env === 'staging') return '#eab308';
  return null;
}
