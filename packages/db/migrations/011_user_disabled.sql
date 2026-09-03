-- Soft-disable accounts for admin moderation (Phase 7.2)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_disabled
  ON public.users (disabled_at)
  WHERE disabled_at IS NOT NULL;

COMMENT ON COLUMN public.users.disabled_at IS
  'When set, user cannot log in or use JWT-authenticated endpoints';
