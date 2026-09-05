-- Atomic per-key daily request counter (rate-limit race fix)

CREATE TABLE IF NOT EXISTS public.api_key_daily_usage (
  api_key_id    UUID NOT NULL REFERENCES public.api_keys (id) ON DELETE CASCADE,
  usage_date    DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (api_key_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_api_key_daily_usage_date
  ON public.api_key_daily_usage (usage_date DESC);
