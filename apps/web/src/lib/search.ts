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

  const q = query.trim();
  const qLower = q.toLowerCase();
  const topLower = top.name.trim().toLowerCase();
  const qKey = normalizeNameKey(query);
  const topKey = normalizeNameKey(top.name);

  if (qKey && topKey && qKey === topKey) return true;
  if (qLower === topLower) return true;

  const topWords = topLower.split(/[^a-z0-9]+/).filter(Boolean);
  const queryIsWholeWord = topWords.includes(qLower);
  const startsWithQuery =
    topLower.startsWith(qLower) ||
    topWords.some((w) => w.startsWith(qLower) && qLower.length >= 3);

  if (q.length <= 4) {
    return queryIsWholeWord || (startsWithQuery && top.score >= 0.85);
  }

  if (top.score < AUTO_MATCH_SCORE) return false;

  const onlyLooseContains =
    !startsWithQuery &&
    !queryIsWholeWord &&
    topLower.includes(qLower) &&
    top.score < 0.85;
  if (onlyLooseContains) return false;

  const second = hits[1];
  if (!second) return top.score >= 0.55 || startsWithQuery;
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
