-- Phase 7.3 — reviewer notes on contribution queue
ALTER TABLE public.edits_queue
  ADD COLUMN IF NOT EXISTS review_note TEXT;

CREATE INDEX IF NOT EXISTS idx_edits_queue_reviewed_at
  ON public.edits_queue (reviewed_at DESC NULLS LAST);

COMMENT ON COLUMN public.edits_queue.review_note IS
  'Optional moderator note when approving or rejecting';
