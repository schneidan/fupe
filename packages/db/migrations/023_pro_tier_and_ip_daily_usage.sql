-- Launch pricing: replace Business with Pro; anonymous entities IP daily counters

-- api_keys.tier: business → pro
ALTER TABLE public.api_keys DROP CONSTRAINT IF EXISTS api_keys_tier_check;
UPDATE public.api_keys
   SET tier = 'pro',
       rate_limit_daily = 50000
 WHERE tier = 'business';
ALTER TABLE public.api_keys
  ADD CONSTRAINT api_keys_tier_check
  CHECK (tier IN ('free', 'developer', 'pro'));

-- users.subscription_tier: business → pro
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_subscription_tier_check;
UPDATE public.users
   SET subscription_tier = 'pro'
 WHERE subscription_tier = 'business';
ALTER TABLE public.users
  ADD CONSTRAINT users_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'developer', 'pro'));

-- Anonymous (no API key) daily IP budgets for directory scrape protection
CREATE TABLE IF NOT EXISTS public.ip_daily_usage (
  client_ip     TEXT NOT NULL,
  bucket        TEXT NOT NULL,
  usage_date    DATE NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (client_ip, bucket, usage_date),
  CHECK (bucket IN ('entities_list', 'entities_detail'))
);

CREATE INDEX IF NOT EXISTS idx_ip_daily_usage_date
  ON public.ip_daily_usage (usage_date DESC);

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  23,
  'fupe_graph',
  'Pro tier replaces Business; ip_daily_usage for anonymous entities caps'
)
ON CONFLICT (version) DO NOTHING;
