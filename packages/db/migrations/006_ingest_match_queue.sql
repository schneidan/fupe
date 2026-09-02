-- Ingest match / dedupe review queue (Phase 4.3)

CREATE TABLE IF NOT EXISTS public.ingest_match_queue (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incoming_entity      JSONB NOT NULL,
  candidate_entity_id  TEXT,
  candidate_name       TEXT,
  score                DOUBLE PRECISION NOT NULL,
  match_reason         TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'accepted', 'rejected', 'merged')),
  source_id            TEXT,
  ingestion_run_id     UUID REFERENCES public.ingestion_runs (id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ingest_match_queue_status
  ON public.ingest_match_queue (status);

CREATE INDEX IF NOT EXISTS idx_ingest_match_queue_candidate
  ON public.ingest_match_queue (candidate_entity_id);

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  6,
  'fupe_graph',
  'ingest_match_queue for low-confidence entity dedupe review'
)
ON CONFLICT (version) DO NOTHING;
