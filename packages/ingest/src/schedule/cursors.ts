import type { Pool, PoolClient } from 'pg';
import type { SourceId } from '../types';

export type CursorKind = 'offset' | 'page';

export interface IngestCursor {
  sourceId: SourceId;
  region: string;
  cursorKind: CursorKind;
  cursorValue: number;
  exhausted: boolean;
}

function regionKey(region?: string): string {
  return (region ?? '').toUpperCase();
}

export async function getCursor(
  client: PoolClient,
  sourceId: SourceId,
  region: string | undefined,
  cursorKind: CursorKind,
): Promise<IngestCursor> {
  const regionVal = regionKey(region);
  const { rows } = await client.query<{
    cursor_kind: CursorKind;
    cursor_value: number;
    exhausted: boolean;
  }>(
    `
      SELECT cursor_kind, cursor_value, exhausted
      FROM public.ingest_cursors
      WHERE source_id = $1 AND region = $2
    `,
    [sourceId, regionVal],
  );

  if (rows[0]) {
    return {
      sourceId,
      region: regionVal,
      cursorKind: rows[0].cursor_kind,
      cursorValue: rows[0].cursor_value,
      exhausted: rows[0].exhausted,
    };
  }

  return {
    sourceId,
    region: regionVal,
    cursorKind,
    cursorValue: cursorKind === 'page' ? 1 : 0,
    exhausted: false,
  };
}

export async function saveCursor(
  client: PoolClient,
  cursor: IngestCursor,
  lastRunId?: string,
): Promise<void> {
  await client.query(
    `
      INSERT INTO public.ingest_cursors (
        source_id, region, cursor_kind, cursor_value, exhausted, last_run_id, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6::uuid, now())
      ON CONFLICT (source_id, region) DO UPDATE SET
        cursor_kind = EXCLUDED.cursor_kind,
        cursor_value = EXCLUDED.cursor_value,
        exhausted = EXCLUDED.exhausted,
        last_run_id = EXCLUDED.last_run_id,
        updated_at = now()
    `,
    [
      cursor.sourceId,
      cursor.region,
      cursor.cursorKind,
      cursor.cursorValue,
      cursor.exhausted,
      lastRunId ?? null,
    ],
  );
}

export async function countEntities(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM fupe_graph."Entity"`,
  );
  return Number(rows[0]?.n ?? 0);
}

export async function countCitations(pool: Pool): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM fupe_graph."Citation"`,
  );
  return Number(rows[0]?.n ?? 0);
}
