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
