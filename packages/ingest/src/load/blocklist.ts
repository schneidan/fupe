import type { PoolClient } from 'pg';
import { normalizeNameKey } from '../normalize';
import type { NormalizedEntity } from '../types';

/**
 * True when this incoming entity matches a moderator blocklist entry
 * (deleted id/slug, external id, or normalized name).
 */
export async function isEntityBlocked(
  client: PoolClient,
  entity: NormalizedEntity,
): Promise<boolean> {
  const nameKey = normalizeNameKey(entity.name);
  const externalIds = entity.externalIds ?? {};
  const externalPairs = Object.entries(externalIds);

  const { rows } = await client.query<{ id: string }>(
    `
      SELECT id
      FROM public.entity_blocklist
      WHERE entity_id = $1
         OR (slug IS NOT NULL AND slug = $2)
         OR name_key = $3
         OR (
           $4::text[] <> '{}'::text[]
           AND EXISTS (
             SELECT 1
             FROM jsonb_each_text(external_ids) AS e(key, value)
             WHERE (e.key || '=' || e.value) = ANY ($4::text[])
           )
         )
      LIMIT 1
    `,
    [
      entity.id,
      entity.slug,
      nameKey,
      externalPairs.map(([k, v]) => `${k}=${v}`),
    ],
  );

  return rows.length > 0;
}
