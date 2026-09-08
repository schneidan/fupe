import { normalizeNameKey } from './slug';

/** Legal / corporate tails that don't change the brand core. */
const CORPORATE_TOKEN =
  /^(inc|incorporated|llc|ltd|limited|corp|corporation|co|company|plc|gmbh|ag|sa|nv|bv|pty)$/i;

export interface RankableHit {
  id: string;
  name: string;
  score: number;
}

/** Strip trailing corporate tokens from a normalized name key. */
export function stripCorporateKey(key: string): string {
  const tokens = key.split(/\s+/).filter(Boolean);
  while (tokens.length > 1 && CORPORATE_TOKEN.test(tokens[tokens.length - 1]!)) {
    tokens.pop();
  }
  return tokens.join(' ');
}

function tokenCount(key: string): number {
  return key.split(/\s+/).filter(Boolean).length;
}

/** True when `other` is the same brand core or a longer extension of `base`. */
export function isNameExtension(base: string, other: string): boolean {
  const b = normalizeNameKey(base);
  const o = normalizeNameKey(other);
  if (!b || !o) return false;
  if (o === b) return true;
  if (o.startsWith(`${b} `)) return true;
  const bCore = stripCorporateKey(b);
  const oCore = stripCorporateKey(o);
  if (!bCore || !oCore) return false;
  return oCore === bCore || oCore.startsWith(`${bCore} `);
}

function simplicityRank(name: string): [number, number, string] {
  const key = normalizeNameKey(name);
  const core = stripCorporateKey(key);
  // Prefer bare core ("Panera") over "Panera Inc" / "Panera Foods"
  return [tokenCount(core), core.length, key];
}

function inQueryFamily(query: string, name: string): boolean {
  const qKey = normalizeNameKey(query);
  const nKey = normalizeNameKey(name);
  if (!qKey || !nKey) return false;
  const qCore = stripCorporateKey(qKey);
  const nCore = stripCorporateKey(nKey);
  if (!qCore || !nCore) return false;

  if (nCore === qCore || nKey === qKey) return true;
  if (nKey.startsWith(`${qCore} `) || nCore.startsWith(`${qCore} `)) return true;
  if (qKey.startsWith(`${nCore} `) || qCore.startsWith(`${nCore} `)) return true;

  const qStem = qCore.split(/\s+/)[0] ?? '';
  const nStem = nCore.split(/\s+/)[0] ?? '';
  return qStem.length >= 4 && qStem === nStem;
}

/**
 * Among close-scoring hits that share a brand family with the query, put the
 * simplest label first ("Panera" over "Panera Inc" / "Panera Foods").
 */
export function preferSimplestFamilyHit<T extends RankableHit>(
  query: string,
  hits: T[],
): T[] {
  if (hits.length < 2) return hits;

  const family = hits.filter((h) => inQueryFamily(query, h.name));
  if (!family.length) return hits;

  const bestFamilyScore = Math.max(...family.map((h) => h.score));
  const contenders = family.filter((h) => h.score >= bestFamilyScore - 0.2);
  if (!contenders.length) return hits;

  const qKey = normalizeNameKey(query);
  const qCore = stripCorporateKey(qKey);

  contenders.sort((a, b) => {
    const aKey = normalizeNameKey(a.name);
    const bKey = normalizeNameKey(b.name);
    const aCore = stripCorporateKey(aKey);
    const bCore = stripCorporateKey(bKey);

    const aExact = Number(aKey === qKey || aCore === qCore);
    const bExact = Number(bKey === qKey || bCore === qCore);
    if (aExact !== bExact) return bExact - aExact;

    const [aTok, aLen, aName] = simplicityRank(a.name);
    const [bTok, bLen, bName] = simplicityRank(b.name);
    if (aTok !== bTok) return aTok - bTok;
    if (aLen !== bLen) return aLen - bLen;
    if (b.score !== a.score) return b.score - a.score;
    return aName.localeCompare(bName);
  });

  const winner = contenders[0]!;
  return [winner, ...hits.filter((h) => h.id !== winner.id)];
}

/**
 * Near-tie siblings that are all extensions of the simplest top hit should not
 * block auto-navigate (Panera vs Panera Inc vs Panera Foods).
 */
export function isSimplestFamilyConfident(
  query: string,
  hits: RankableHit[],
): boolean {
  const top = hits[0];
  if (!top) return false;
  if (!inQueryFamily(query, top.name)) return false;

  const near = hits.filter((h) => h.score >= top.score - 0.2);
  if (near.length < 2) return false;

  const related = near.filter((h) => inQueryFamily(query, h.name));
  if (related.length < 2) return false;

  const allExtendTop = related.every(
    (h) =>
      isNameExtension(top.name, h.name) || isNameExtension(h.name, top.name),
  );
  if (!allExtendTop) return false;

  const [topTok, topLen] = simplicityRank(top.name);
  const topIsSimplest = related.every((h) => {
    const [tok, len] = simplicityRank(h.name);
    if (tok !== topTok) return tok > topTok;
    return len >= topLen;
  });
  if (!topIsSimplest) return false;

  const qKey = normalizeNameKey(query);
  const qCore = stripCorporateKey(qKey);
  const topKey = normalizeNameKey(top.name);
  const topCore = stripCorporateKey(topKey);

  // Query is the brand (or a longer form of it) and top is the simplest label.
  return (
    topCore === qCore ||
    topKey === qKey ||
    qCore.startsWith(`${topCore} `) ||
    qKey.startsWith(`${topKey} `) ||
    topKey.startsWith(`${qCore} `)
  );
}
