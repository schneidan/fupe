/** URL-safe slug from a brand or company name. */
export function toSlug(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Best-effort query string from an entity slug. */
export function slugToQuery(slug: string): string {
  return decodeURIComponent(slug).replace(/-/g, ' ').trim();
}

/** Canonical entity detail URL (search + browse both land here). */
export function entityPath(nameOrSlug: string): string {
  return `/entity/${toSlug(nameOrSlug)}`;
}
