-- Phase 6.1: API keys + usage log for third-party access

CREATE TABLE IF NOT EXISTS public.api_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT 'Default',
  key_prefix      TEXT NOT NULL,
  key_hash        TEXT NOT NULL UNIQUE,
  tier            TEXT NOT NULL DEFAULT 'free'
                    CHECK (tier IN ('free', 'developer', 'business')),
  rate_limit_daily INTEGER NOT NULL DEFAULT 100,
  last_used_at    TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON public.api_keys (key_prefix);

CREATE TABLE IF NOT EXISTS public.api_usage_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id   UUID REFERENCES public.api_keys (id) ON DELETE SET NULL,
  endpoint     TEXT NOT NULL,
  method       TEXT NOT NULL,
  status_code  INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_usage_log_key_created
  ON public.api_usage_log (api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_log_created
  ON public.api_usage_log (created_at DESC);

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  9,
  'fupe_graph',
  'api_keys and api_usage_log for public API access'
)
ON CONFLICT (version) DO NOTHING;
