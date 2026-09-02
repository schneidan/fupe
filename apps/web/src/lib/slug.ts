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

/** Best-effort query string from a result slug. */
export function slugToQuery(slug: string): string {
  return decodeURIComponent(slug).replace(/-/g, ' ').trim();
}

export function resultPath(nameOrSlug: string): string {
  return `/result/${toSlug(nameOrSlug)}`;
}
