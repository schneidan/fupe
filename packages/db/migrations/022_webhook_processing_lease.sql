-- Concurrent Stripe webhook claim: lease so two workers cannot process the same event

ALTER TABLE public.stripe_webhook_log
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;

COMMENT ON COLUMN public.stripe_webhook_log.processing_started_at IS
  'Lease timestamp while a worker is handling the event; cleared conceptually by processed_at.';
