-- Phase 6.2: Stripe subscription fields for API tiers

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'developer', 'business')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT;

CREATE INDEX IF NOT EXISTS idx_users_stripe_customer
  ON public.users (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  10,
  'fupe_graph',
  'Stripe subscription fields on users for API tiers'
)
ON CONFLICT (version) DO NOTHING;
