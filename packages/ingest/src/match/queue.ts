import type { PoolClient } from 'pg';
import type { NormalizedEntity } from '../types';

export async function enqueueMatchReview(
  client: PoolClient,
  opts: {
    incoming: NormalizedEntity;
    candidateEntityId: string;
    candidateName: string;
    score: number;
    reason: string;
    sourceId: string;
    ingestionRunId?: string;
  },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `
      INSERT INTO public.ingest_match_queue (
        incoming_entity,
        candidate_entity_id,
        candidate_name,
        score,
        match_reason,
        status,
        source_id,
        ingestion_run_id
      )
      VALUES ($1::jsonb, $2, $3, $4, $5, 'pending', $6, $7::uuid)
      RETURNING id::text AS id
    `,
    [
      JSON.stringify(opts.incoming),
      opts.candidateEntityId,
      opts.candidateName,
      opts.score,
      opts.reason,
      opts.sourceId,
      opts.ingestionRunId ?? null,
    ],
  );
  return rows[0].id;
}
