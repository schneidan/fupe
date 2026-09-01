-- FUPE Graph Database Initialization
-- PostgreSQL + Apache AGE (OpenCypher)
--
-- Graph: fupe_graph
--
-- Nodes:
--   (:Entity {id, name, type})  type ∈ BRAND | SUBSIDIARY | PARENT_CORP | PE_FIRM | VC_FIRM
--   (:Product {gtin, name, category})
--   (:Citation {id, url, title})
--
-- Relationships:
--   (:Product)-[:MANUFACTURED_BY]->(:Entity)
--   (:Entity)-[:OWNED_BY {percentage}]->(:Entity)
--   (:Entity)-[:PORTFOLIO_COMPANY_OF]->(:Entity)
--   (:Entity)-[:HAS_CITATION]->(:Citation)

-- ── Extension & session setup ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS age;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

-- ── Create graph (idempotent) ────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM ag_catalog.ag_graph WHERE name = 'fupe_graph') THEN
    PERFORM create_graph('fupe_graph');
  END IF;
END $$;

-- ── Vertex labels (idempotent) ───────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ag_catalog.ag_label l
    JOIN ag_catalog.ag_graph g ON g.graphid = l.graph
    WHERE g.name = 'fupe_graph' AND l.name = 'Entity' AND l.kind = 'v'
  ) THEN PERFORM create_vlabel('fupe_graph', 'Entity'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ag_catalog.ag_label l
    JOIN ag_catalog.ag_graph g ON g.graphid = l.graph
    WHERE g.name = 'fupe_graph' AND l.name = 'Product' AND l.kind = 'v'
  ) THEN PERFORM create_vlabel('fupe_graph', 'Product'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ag_catalog.ag_label l
    JOIN ag_catalog.ag_graph g ON g.graphid = l.graph
    WHERE g.name = 'fupe_graph' AND l.name = 'Citation' AND l.kind = 'v'
  ) THEN PERFORM create_vlabel('fupe_graph', 'Citation'); END IF;
END $$;

-- ── Edge labels (idempotent) ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ag_catalog.ag_label l
    JOIN ag_catalog.ag_graph g ON g.graphid = l.graph
    WHERE g.name = 'fupe_graph' AND l.name = 'MANUFACTURED_BY' AND l.kind = 'e'
  ) THEN PERFORM create_elabel('fupe_graph', 'MANUFACTURED_BY'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ag_catalog.ag_label l
    JOIN ag_catalog.ag_graph g ON g.graphid = l.graph
    WHERE g.name = 'fupe_graph' AND l.name = 'OWNED_BY' AND l.kind = 'e'
  ) THEN PERFORM create_elabel('fupe_graph', 'OWNED_BY'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ag_catalog.ag_label l
    JOIN ag_catalog.ag_graph g ON g.graphid = l.graph
    WHERE g.name = 'fupe_graph' AND l.name = 'PORTFOLIO_COMPANY_OF' AND l.kind = 'e'
  ) THEN PERFORM create_elabel('fupe_graph', 'PORTFOLIO_COMPANY_OF'); END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ag_catalog.ag_label l
    JOIN ag_catalog.ag_graph g ON g.graphid = l.graph
    WHERE g.name = 'fupe_graph' AND l.name = 'HAS_CITATION' AND l.kind = 'e'
  ) THEN PERFORM create_elabel('fupe_graph', 'HAS_CITATION'); END IF;
END $$;

-- ── Property indexes (cast agtype properties to jsonb for indexing) ──────────
CREATE INDEX IF NOT EXISTS idx_entity_id
  ON fupe_graph."Entity" USING btree (((properties::jsonb->>'id')));

CREATE INDEX IF NOT EXISTS idx_entity_name
  ON fupe_graph."Entity" USING gin (((properties::jsonb->>'name')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entity_type
  ON fupe_graph."Entity" USING btree (((properties::jsonb->>'type')));

CREATE INDEX IF NOT EXISTS idx_product_gtin
  ON fupe_graph."Product" USING btree (((properties::jsonb->>'gtin')));

CREATE INDEX IF NOT EXISTS idx_product_name
  ON fupe_graph."Product" USING gin (((properties::jsonb->>'name')) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_citation_id
  ON fupe_graph."Citation" USING btree (((properties::jsonb->>'id')));

-- ── Schema metadata table (relational, for API introspection) ───────────────
CREATE TABLE IF NOT EXISTS public.graph_schema_version (
  version     INTEGER PRIMARY KEY,
  graph_name  TEXT NOT NULL,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  description TEXT
);

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  1,
  'fupe_graph',
  'Initial graph: Entity, Product, Citation nodes; MANUFACTURED_BY, OWNED_BY, PORTFOLIO_COMPANY_OF, HAS_CITATION edges'
)
ON CONFLICT (version) DO NOTHING;
