-- Stripe webhook idempotency: only process each event once

ALTER TABLE public.stripe_webhook_log
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

UPDATE public.stripe_webhook_log
   SET processed_at = COALESCE(processed_at, received_at)
 WHERE processed_at IS NULL;
