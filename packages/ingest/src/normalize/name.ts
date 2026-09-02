/** Name normalization helpers (expanded in Phase 4.3). */

const CORPORATE_SUFFIXES =
  /\b(inc\.?|incorporated|llc|l\.l\.c\.?|ltd\.?|limited|corp\.?|corporation|co\.?|company|plc|gmbh|ag|sa|s\.a\.|nv|bv|pty|kk|kabushiki kaisha)\b\.?$/gi;

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

export function toSlug(name: string): string {
  return normalizeNameKey(stripCorporateSuffix(name))
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function normalizeCountryCode(code: string): string {
  return code.trim().toUpperCase();
}
