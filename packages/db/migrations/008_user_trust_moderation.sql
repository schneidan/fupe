-- Phase 5.2: email verification + moderator role

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS email_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS email_verify_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_role_check
      CHECK (role IN ('user', 'moderator', 'admin'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_verify_token
  ON public.users (email_verify_token)
  WHERE email_verify_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_role ON public.users (role);

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  8,
  'fupe_graph',
  'users email verification + role for moderation'
)
ON CONFLICT (version) DO NOTHING;
