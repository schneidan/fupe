-- Password reset tokens (forgot-password flow)

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
  ADD COLUMN IF NOT EXISTS password_reset_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_password_reset_token
  ON public.users (password_reset_token)
  WHERE password_reset_token IS NOT NULL;

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  14,
  'fupe_graph',
  'users password_reset_token for forgot-password flow'
)
ON CONFLICT (version) DO NOTHING;
