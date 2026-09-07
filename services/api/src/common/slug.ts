/** Lowercase collapsed key for blocklist / fuzzy name matching. */
export function normalizeNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Slug/id helper aligned with ingest normalize conventions. */
export function toSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\b(inc\.?|llc|ltd\.?|corp\.?|co\.?)\b\.?/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
