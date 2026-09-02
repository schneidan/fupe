import type { Pool, PoolClient } from 'pg';
import type { SourceId } from '../types';
import { SOURCE_META } from '../config';

export async function ensureDataSource(
  client: PoolClient,
  sourceId: SourceId,
): Promise<void> {
  const meta = SOURCE_META[sourceId];
  await client.query(
    `
      INSERT INTO public.data_sources (id, name, license, attribution_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        license = EXCLUDED.license,
        attribution_url = EXCLUDED.attribution_url
    `,
    [sourceId, meta.name, meta.license, meta.attributionUrl],
  );
}

export async function startIngestionRun(
  client: PoolClient,
  sourceId: SourceId,
  metadata?: Record<string, unknown>,
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `
      INSERT INTO public.ingestion_runs (source_id, status, metadata)
      VALUES ($1, 'running', $2::jsonb)
      RETURNING id::text AS id
    `,
    [sourceId, JSON.stringify(metadata ?? {})],
  );
  return rows[0].id;
}

export async function finishIngestionRun(
  client: PoolClient,
  runId: string,
  status: 'success' | 'failed',
  recordsProcessed: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `
      UPDATE public.ingestion_runs
      SET
        status = $2,
        records_processed = $3,
        finished_at = now(),
        metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
      WHERE id = $1::uuid
    `,
    [runId, status, recordsProcessed, JSON.stringify(metadata ?? {})],
  );
}

export async function pingDatabase(pool: Pool): Promise<void> {
  await pool.query('SELECT 1');
}
