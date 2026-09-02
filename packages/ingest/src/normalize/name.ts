/** Name normalization helpers for ingest matching. */

const CORPORATE_SUFFIXES =
  /\b(inc\.?|incorporated|llc|l\.l\.c\.?|ltd\.?|limited|corp\.?|corporation|co\.?|company|plc|gmbh|ag|sa|s\.a\.|nv|bv|pty|kk|kabushiki kaisha)\b\.?$/gi;

/** Tokens that often distinguish different orgs with similar brand stems. */
const DISCRIMINATOR_TOKENS = new Set([
  'org',
  'com',
  'net',
  'edu',
  'gov',
  'io',
  'co',
  'nonprofit',
  'non-profit',
  'foundation',
  'charity',
  'university',
  'college',
]);

export function trimCollapse(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Lowercase, strip punctuation-ish noise for matching. */
export function normalizeNameKey(name: string): string {
  return trimCollapse(name)
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop common corporate suffixes for fuzzy match keys. */
export function stripCorporateSuffix(name: string): string {
  let out = trimCollapse(name);
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(CORPORATE_SUFFIXES, '').trim();
  }
  return out;
}

export function nameTokens(name: string): string[] {
  return normalizeNameKey(stripCorporateSuffix(name))
    .split(' ')
    .filter(Boolean);
}

export function tokenJaccard(a: string[], b: string[]): number {
  if (!a.length && !b.length) return 1;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const t of setA) {
    if (setB.has(t)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * True when both names carry different discriminator tokens
 * (e.g. wordpress.org vs wordpress.com → org vs com).
 */
export function hasConflictingDiscriminator(
  aTokens: string[],
  bTokens: string[],
): boolean {
  const aDisc = aTokens.filter((t) => DISCRIMINATOR_TOKENS.has(t));
  const bDisc = bTokens.filter((t) => DISCRIMINATOR_TOKENS.has(t));
  if (!aDisc.length || !bDisc.length) return false;
  return (
    aDisc.some((t) => !bDisc.includes(t)) ||
    bDisc.some((t) => !aDisc.includes(t))
  );
}

export function toSlug(name: string): string {
  return normalizeNameKey(stripCorporateSuffix(name))
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeCountryCode(code: string): string {
  return code.trim().toUpperCase();
}
