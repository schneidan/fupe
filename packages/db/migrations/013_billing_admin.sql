-- Phase 7.4 — subscription period end, webhook inbox, admin audit

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT UNIQUE,
  event_type      TEXT NOT NULL,
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_log_received
  ON public.stripe_webhook_log (received_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID REFERENCES public.users (id) ON DELETE SET NULL,
  action          TEXT NOT NULL,
  target_type     TEXT NOT NULL,
  target_id       TEXT NOT NULL,
  previous_state  JSONB,
  new_state       JSONB,
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created
  ON public.admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_target
  ON public.admin_audit_log (target_type, target_id);
