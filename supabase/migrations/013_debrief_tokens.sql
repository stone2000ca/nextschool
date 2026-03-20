-- E51-S1A: Debrief tokens for one-time email deep links
-- Run by James via: supabase db push

CREATE TABLE IF NOT EXISTS debrief_tokens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  token       TEXT UNIQUE NOT NULL,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id   TEXT NOT NULL,
  school_slug TEXT,
  visit_id    TEXT NOT NULL,
  reaction    TEXT,
  used_at     TIMESTAMPTZ,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for fast token lookups (email click path)
CREATE INDEX IF NOT EXISTS idx_debrief_tokens_token ON debrief_tokens(token);

-- Index for finding tokens by user (cleanup/admin)
CREATE INDEX IF NOT EXISTS idx_debrief_tokens_user_id ON debrief_tokens(user_id);

-- RLS: service role only (tokens are created/consumed server-side)
ALTER TABLE debrief_tokens ENABLE ROW LEVEL SECURITY;

-- No public/anon policies — only service role can read/write
