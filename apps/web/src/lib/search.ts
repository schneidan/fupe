import { entityPath } from '@/lib/slug';

export interface SearchHit {
  kind: 'entity' | 'product';
  id: string;
  name: string;
  type?: string;
  gtin?: string;
  slug?: string;
  score: number;
}

const AUTO_MATCH_SCORE = 0.42;
const AUTO_MATCH_GAP = 0.1;

function normalizeNameKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mirror API confidence so the form doesn't bounce through a wrong /entity URL. */
export function isConfidentSearchMatch(
  query: string,
  hits: SearchHit[],
): boolean {
  const top = hits[0];
  if (!top) return false;

  const qKey = normalizeNameKey(query);
  const topKey = normalizeNameKey(top.name);
  if (qKey && topKey && qKey === topKey) return true;
  if (query.trim().toLowerCase() === top.name.trim().toLowerCase()) return true;

  if (top.score < AUTO_MATCH_SCORE) return false;
  const second = hits[1];
  if (!second) return true;
  if (top.score - second.score >= AUTO_MATCH_GAP) return true;
  return top.score >= 0.72 && top.score - second.score >= 0.05;
}

export function pathForSearchHit(hit: SearchHit): string {
  if (hit.kind === 'product' && hit.gtin) {
    // Products resolve via barcode on the entity page path using name lookup;
    // prefer manufacturer entity when we only have a product name hit.
    return entityPath(hit.name);
  }
  return entityPath(hit.slug || hit.name);
}
