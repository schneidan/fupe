import type { PoolClient } from 'pg';
import { runCypherWrite } from '../load/client';

export interface StaleFlagResult {
  scanned: number;
  flagged: number;
  staleMonths: number;
}

/**
 * Mark Citation nodes as stale when retrieved_at is older than N months.
 * Citations without retrieved_at are left alone (legacy seed data).
 */
export async function flagStaleCitations(
  client: PoolClient,
  staleMonths = 6,
): Promise<StaleFlagResult> {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - staleMonths);
  const cutoffIso = cutoff.toISOString();

  // AGE: pull candidates via SQL on properties, then set stale via Cypher.
  const { rows } = await client.query<{ id: string; retrieved_at: string | null }>(
    `
      SELECT
        properties::jsonb->>'id' AS id,
        properties::jsonb->>'retrieved_at' AS retrieved_at
      FROM fupe_graph."Citation"
      WHERE properties::jsonb ? 'retrieved_at'
        AND (properties::jsonb->>'retrieved_at') < $1
        AND COALESCE(properties::jsonb->>'stale', 'false') <> 'true'
    `,
    [cutoffIso],
  );

  let flagged = 0;
  for (const row of rows) {
    if (!row.id) continue;
    await runCypherWrite(
      client,
      `
        MATCH (c:Citation {id: $id})
        SET c.stale = true
        RETURN c
      `,
      { id: row.id },
    );
    flagged++;
  }

  const { rows: scannedRows } = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM fupe_graph."Citation"`,
  );

  return {
    scanned: Number(scannedRows[0]?.n ?? 0),
    flagged,
    staleMonths,
  };
}
