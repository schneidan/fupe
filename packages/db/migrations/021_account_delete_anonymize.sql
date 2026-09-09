-- Allow anonymizing contribution attribution when a user deletes their account
-- (keep revision/edit rows; drop the user FK pointer).

ALTER TABLE public.wiki_revisions
  ALTER COLUMN edited_by DROP NOT NULL;

ALTER TABLE public.wiki_revisions
  DROP CONSTRAINT IF EXISTS wiki_revisions_edited_by_fkey;

ALTER TABLE public.wiki_revisions
  ADD CONSTRAINT wiki_revisions_edited_by_fkey
  FOREIGN KEY (edited_by) REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.audit_logs
  ALTER COLUMN edited_by DROP NOT NULL;

ALTER TABLE public.audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_edited_by_fkey;

ALTER TABLE public.audit_logs
  ADD CONSTRAINT audit_logs_edited_by_fkey
  FOREIGN KEY (edited_by) REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.edits_queue
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.edits_queue
  DROP CONSTRAINT IF EXISTS edits_queue_user_id_fkey;

ALTER TABLE public.edits_queue
  ADD CONSTRAINT edits_queue_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE SET NULL;
