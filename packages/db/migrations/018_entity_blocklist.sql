-- Entity blocklist: prevent re-import of deliberately removed entities

CREATE TABLE IF NOT EXISTS public.entity_blocklist (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       TEXT NOT NULL,
  slug            TEXT,
  name            TEXT NOT NULL,
  name_key        TEXT NOT NULL,
  external_ids    JSONB NOT NULL DEFAULT '{}'::jsonb,
  aliases         JSONB NOT NULL DEFAULT '[]'::jsonb,
  source          TEXT,
  reason          TEXT,
  blocked_by      UUID REFERENCES public.users (id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_blocklist_entity_id
  ON public.entity_blocklist (entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_blocklist_slug
  ON public.entity_blocklist (slug)
  WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entity_blocklist_name_key
  ON public.entity_blocklist (name_key);

CREATE INDEX IF NOT EXISTS idx_entity_blocklist_external_ids
  ON public.entity_blocklist USING GIN (external_ids);

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  18,
  'fupe_graph',
  'entity_blocklist for deleted entities that must not be re-imported'
)
ON CONFLICT (version) DO NOTHING;
