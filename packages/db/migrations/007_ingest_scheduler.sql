-- Ingest scheduler cursors (Phase 4.4)

CREATE TABLE IF NOT EXISTS public.ingest_cursors (
  source_id     TEXT NOT NULL,
  region        TEXT NOT NULL DEFAULT '',
  cursor_kind   TEXT NOT NULL CHECK (cursor_kind IN ('offset', 'page')),
  cursor_value  INTEGER NOT NULL DEFAULT 0,
  exhausted     BOOLEAN NOT NULL DEFAULT false,
  last_run_id   UUID REFERENCES public.ingestion_runs (id),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, region)
);

CREATE INDEX IF NOT EXISTS idx_ingest_cursors_updated
  ON public.ingest_cursors (updated_at DESC);

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  7,
  'fupe_graph',
  'ingest_cursors for scheduled backfill / refresh'
)
ON CONFLICT (version) DO NOTHING;
