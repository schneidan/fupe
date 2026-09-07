-- Pending email change + richer account profile fields

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pending_email TEXT,
  ADD COLUMN IF NOT EXISTS email_change_token TEXT,
  ADD COLUMN IF NOT EXISTS email_change_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS organization TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_pending_email_uidx
  ON public.users (lower(pending_email))
  WHERE pending_email IS NOT NULL;

COMMENT ON COLUMN public.users.pending_email IS
  'New email awaiting confirmation via email_change_token';
COMMENT ON COLUMN public.users.organization IS
  'Optional org / affiliation shown on the account page';
COMMENT ON COLUMN public.users.location IS
  'Optional freeform location (city, region, country)';

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  20,
  'fupe_graph',
  'pending email change + organization/location profile fields'
)
ON CONFLICT (version) DO NOTHING;
