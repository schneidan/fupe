import type { PoolClient } from 'pg';
import {
  hasConflictingDiscriminator,
  nameTokens,
  normalizeNameKey,
  stripCorporateSuffix,
  tokenJaccard,
  toSlug,
} from '../normalize';
import type { NormalizedEntity } from '../types';

export type MatchDecision =
  | {
      kind: 'auto';
      entityId: string;
      score: number;
      reason: string;
    }
  | {
      kind: 'review';
      entityId: string;
      candidateName: string;
      score: number;
      reason: string;
    }
  | { kind: 'none' };

/**
 * Fuzzy auto-merge is NOT score-only.
 * We only auto-merge when normalized keys match (alias / Inc. variants).
 * Mid-confidence fuzzy hits go to review only if token overlap is high
 * and discriminators like org/com do not conflict.
 */
export const REVIEW_SCORE_THRESHOLD = 0.6;
export const REVIEW_JACCARD_THRESHOLD = 0.75;

interface CandidateRow {
  id: string;
  name: string;
  slug: string | null;
  country_codes: string | null;
  external_ids: string | null;
  score: number;
}

function parseJsonField<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function countriesOverlap(
  incoming: string[],
  candidateRaw: string | null,
): boolean {
  if (!incoming.length) return true;
  const candidate = parseJsonField<string[]>(candidateRaw) ?? [];
  if (!candidate.length) return true;
  const set = new Set(candidate.map((c) => c.toUpperCase()));
  return incoming.some((c) => set.has(c.toUpperCase()));
}

async function findByExternalId(
  client: PoolClient,
  key: string,
  value: string,
): Promise<CandidateRow | null> {
  const { rows } = await client.query<CandidateRow>(
    `
      SELECT
        properties::jsonb->>'id' AS id,
        properties::jsonb->>'name' AS name,
        properties::jsonb->>'slug' AS slug,
        properties::jsonb->>'country_codes' AS country_codes,
        properties::jsonb->>'external_ids' AS external_ids,
        1.0::float8 AS score
      FROM fupe_graph."Entity"
      WHERE properties::jsonb ? 'external_ids'
        AND (properties::jsonb->>'external_ids')::jsonb->>$1 = $2
      LIMIT 1
    `,
    [key, value],
  );
  return rows[0] ?? null;
}

async function findBySlugOrId(
  client: PoolClient,
  idOrSlug: string,
): Promise<CandidateRow | null> {
  const { rows } = await client.query<CandidateRow>(
    `
      SELECT
        properties::jsonb->>'id' AS id,
        properties::jsonb->>'name' AS name,
        properties::jsonb->>'slug' AS slug,
        properties::jsonb->>'country_codes' AS country_codes,
        properties::jsonb->>'external_ids' AS external_ids,
        1.0::float8 AS score
      FROM fupe_graph."Entity"
      WHERE properties::jsonb->>'id' = $1
         OR properties::jsonb->>'slug' = $1
      LIMIT 1
    `,
    [idOrSlug],
  );
  return rows[0] ?? null;
}

async function findByNormalizedKey(
  client: PoolClient,
  key: string,
): Promise<CandidateRow[]> {
  const { rows } = await client.query<CandidateRow>(
    `
      SELECT
        properties::jsonb->>'id' AS id,
        properties::jsonb->>'name' AS name,
        properties::jsonb->>'slug' AS slug,
        properties::jsonb->>'country_codes' AS country_codes,
        properties::jsonb->>'external_ids' AS external_ids,
        1.0::float8 AS score
      FROM fupe_graph."Entity"
      WHERE regexp_replace(
          regexp_replace(lower(properties::jsonb->>'name'), '''', '', 'g'),
          '[^a-z0-9]+', ' ', 'g'
        ) = $1
         OR regexp_replace(
          regexp_replace(
            regexp_replace(lower(properties::jsonb->>'name'), '''', '', 'g'),
            '\\m(inc|llc|ltd|limited|corp|corporation|company|co|plc)\\M\\.?$',
            '',
            'gi'
          ),
          '[^a-z0-9]+', ' ', 'g'
        ) = $1
      LIMIT 5
    `,
    [key],
  );
  return rows;
}

async function findFuzzyByName(
  client: PoolClient,
  name: string,
  limit = 5,
): Promise<CandidateRow[]> {
  const key = normalizeNameKey(stripCorporateSuffix(name));
  const { rows } = await client.query<CandidateRow>(
    `
      SELECT
        properties::jsonb->>'id' AS id,
        properties::jsonb->>'name' AS name,
        properties::jsonb->>'slug' AS slug,
        properties::jsonb->>'country_codes' AS country_codes,
        properties::jsonb->>'external_ids' AS external_ids,
        similarity(
          regexp_replace(lower(properties::jsonb->>'name'), '[^a-z0-9]+', ' ', 'g'),
          $1
        ) AS score
      FROM fupe_graph."Entity"
      WHERE similarity(
        regexp_replace(lower(properties::jsonb->>'name'), '[^a-z0-9]+', ' ', 'g'),
        $1
      ) >= $2
      ORDER BY score DESC
      LIMIT $3
    `,
    [key, REVIEW_SCORE_THRESHOLD, limit],
  );
  return rows;
}

/**
 * Resolve an incoming ingest entity against the existing graph.
 * Priority: external id → exact id/slug → equal normalized key → cautious fuzzy review.
 */
export async function resolveEntityMatch(
  client: PoolClient,
  entity: NormalizedEntity,
): Promise<MatchDecision> {
  const wikidataId = entity.externalIds?.wikidata;
  if (wikidataId) {
    const hit = await findByExternalId(client, 'wikidata', wikidataId);
    if (hit?.id) {
      return {
        kind: 'auto',
        entityId: hit.id,
        score: 1,
        reason: `external_ids.wikidata=${wikidataId}`,
      };
    }
  }

  const companiesHouseId = entity.externalIds?.companies_house;
  if (companiesHouseId) {
    const hit = await findByExternalId(
      client,
      'companies_house',
      companiesHouseId,
    );
    if (hit?.id) {
      return {
        kind: 'auto',
        entityId: hit.id,
        score: 1,
        reason: `external_ids.companies_house=${companiesHouseId}`,
      };
    }
  }

  const exact = await findBySlugOrId(client, entity.id);
  if (exact?.id) {
    return {
      kind: 'auto',
      entityId: exact.id,
      score: 1,
      reason: `exact id ${entity.id}`,
    };
  }

  const slug = entity.slug || toSlug(entity.name);
  if (slug && slug !== entity.id) {
    const bySlug = await findBySlugOrId(client, slug);
    if (bySlug?.id) {
      return {
        kind: 'auto',
        entityId: bySlug.id,
        score: 0.98,
        reason: `exact slug ${slug}`,
      };
    }
  }

  // Alias / "Inc." variants only — not "similar sounding" brands.
  const incomingKey = normalizeNameKey(stripCorporateSuffix(entity.name));
  const keyHits = await findByNormalizedKey(client, incomingKey);
  for (const hit of keyHits) {
    if (!countriesOverlap(entity.countryCodes, hit.country_codes)) continue;
    return {
      kind: 'auto',
      entityId: hit.id,
      score: 0.99,
      reason: `normalized key "${incomingKey}"`,
    };
  }

  const incomingTokens = nameTokens(entity.name);
  const fuzzy = await findFuzzyByName(client, entity.name);
  for (const candidate of fuzzy) {
    if (!countriesOverlap(entity.countryCodes, candidate.country_codes)) {
      continue;
    }

    const candidateTokens = nameTokens(candidate.name);
    if (hasConflictingDiscriminator(incomingTokens, candidateTokens)) {
      continue; // e.g. wordpress.org vs wordpress.com
    }

    const jaccard = tokenJaccard(incomingTokens, candidateTokens);
    if (
      candidate.score >= REVIEW_SCORE_THRESHOLD &&
      jaccard >= REVIEW_JACCARD_THRESHOLD
    ) {
      return {
        kind: 'review',
        entityId: candidate.id,
        candidateName: candidate.name,
        score: candidate.score,
        reason: `fuzzy review "${candidate.name}" score=${candidate.score.toFixed(3)} jaccard=${jaccard.toFixed(3)}`,
      };
    }
  }

  return { kind: 'none' };
}
