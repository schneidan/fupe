/** Shared site URL / OG helpers for metadata. */

export const OG_DEFAULT_IMAGE = '/brand/og-default.png';

export function resolveSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[fupe] NEXT_PUBLIC_SITE_URL unset in production — falling back to https://fupe.app',
    );
    return 'https://fupe.app';
  }
  return 'http://localhost:3001';
}

export const defaultOgImages = [
  {
    url: OG_DEFAULT_IMAGE,
    width: 1200,
    height: 630,
    alt: 'FUPE — Find Ultimate Parent Entity',
  },
] as const;
