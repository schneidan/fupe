-- FUPE Relational Tables
-- User auth, crowdsourced edit queue, audit logs, wiki revision history

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Users ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  trust_score  INTEGER NOT NULL DEFAULT 0 CHECK (trust_score >= 0 AND trust_score <= 100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);

-- ── Edits queue (crowdsourced proposals) ─────────────────────────────────────
CREATE TYPE public.edit_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE IF NOT EXISTS public.edits_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  target_node_id  TEXT NOT NULL,
  proposed_data   JSONB NOT NULL,
  citation_url    TEXT,
  status          public.edit_status NOT NULL DEFAULT 'PENDING',
  reviewer_id     UUID REFERENCES public.users (id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edits_queue_status ON public.edits_queue (status);
CREATE INDEX IF NOT EXISTS idx_edits_queue_user ON public.edits_queue (user_id);

-- ── Audit logs (immutable change record) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id       TEXT NOT NULL,
  previous_state  JSONB,
  new_state       JSONB NOT NULL,
  edited_by       UUID NOT NULL REFERENCES public.users (id),
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs (entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_edited_by ON public.audit_logs (edited_by);

-- ── Wiki revision history ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wiki_revisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id     TEXT NOT NULL,
  revision_data JSONB NOT NULL,
  citation_url  TEXT,
  edited_by     UUID NOT NULL REFERENCES public.users (id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wiki_revisions_entity ON public.wiki_revisions (entity_id);

INSERT INTO public.graph_schema_version (version, graph_name, description)
VALUES (
  2,
  'fupe_graph',
  'Relational tables: users, edits_queue, audit_logs, wiki_revisions'
)
ON CONFLICT (version) DO NOTHING;
