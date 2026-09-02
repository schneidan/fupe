-- Entity metadata properties + ETL audit tables

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- Relational ETL audit trail
CREATE TABLE IF NOT EXISTS public.data_sources (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  license         TEXT,
  attribution_url TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ingestion_runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id          TEXT NOT NULL REFERENCES public.data_sources (id),
  status             TEXT NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  records_processed  INTEGER NOT NULL DEFAULT 0,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at        TIMESTAMPTZ,
  metadata           JSONB
);

CREATE INDEX IF NOT EXISTS idx_ingestion_runs_source ON public.ingestion_runs (source_id);

INSERT INTO public.data_sources (id, name, license, attribution_url)
VALUES (
  'seed',
  'FUPE manual seed data',
  'internal',
  NULL
)
ON CONFLICT (id) DO NOTHING;

SELECT * FROM cypher('fupe_graph', $$
  MATCH (e:Entity)
  SET
    e.slug = e.id,
    e.country_codes = '["US"]',
    e.source = 'seed',
    e.updated_at = '2026-09-01'
$$) AS (result agtype);

SELECT * FROM cypher('fupe_graph', $$
  MATCH (e:Entity)
  WHERE e.type IN ['PE_FIRM', 'VC_FIRM']
  SET e.sector = 'Private Equity'
$$) AS (result agtype);

SELECT * FROM cypher('fupe_graph', $$
  MATCH (e:Entity)
  WHERE e.type = 'SUBSIDIARY'
  SET e.sector = 'Restaurant Group'
$$) AS (result agtype);

SELECT * FROM cypher('fupe_graph', $$
  MATCH (e:Entity)
  WHERE e.type = 'BRAND'
  SET e.sector = 'Quick Service Restaurant'
$$) AS (result agtype);

SELECT * FROM cypher('fupe_graph', $$
  MATCH (e:Entity {id: 'dunkin'})
  SET e.aliases = '["Dunkin Donuts"]'
$$) AS (result agtype);

SELECT * FROM cypher('fupe_graph', $$
  MATCH (e:Entity {id: 'mcdonalds'})
  SET e.aliases = '["McDonald''s"]'
$$) AS (result agtype);

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  5,
  'fupe_graph',
  'Entity metadata properties + data_sources / ingestion_runs tables'
)
ON CONFLICT (version) DO NOTHING;
