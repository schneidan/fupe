-- Optional product updates / major feature notices (marketing-ish, consent-gated)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS email_updates_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_updates_opt_in_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.display_name IS
  'Optional public/display name for the account page';
COMMENT ON COLUMN public.users.email_updates_opt_in IS
  'Consent to occasional FUPE product update emails (not transactional edit mail)';

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  19,
  'fupe_graph',
  'users.display_name + email_updates_opt_in for account preferences'
)
ON CONFLICT (version) DO NOTHING;
