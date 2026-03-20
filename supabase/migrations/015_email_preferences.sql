-- E51-S4B: Email preferences & unsubscribe
-- Adds email_notifications_enabled column to user_profiles
-- and creates unsubscribe_tokens table for tokenized email unsubscribe links

-- 1. Add email preference column to user_profiles
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Create unsubscribe_tokens table (reuses debrief token pattern from S1A)
CREATE TABLE IF NOT EXISTS unsubscribe_tokens (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  token      TEXT UNIQUE NOT NULL,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at    TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_token ON unsubscribe_tokens(token);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_user_id ON unsubscribe_tokens(user_id);

-- RLS for unsubscribe_tokens: service role only (created/consumed server-side)
ALTER TABLE unsubscribe_tokens ENABLE ROW LEVEL SECURITY;

-- 3. RLS policy: users can read/update their own email_notifications_enabled
-- The user_profiles table already has RLS enabled with user-scoped policies.
-- Ensure the existing SELECT/UPDATE policies cover the new column (they do,
-- since they use SELECT * / UPDATE on the row level, not column level).
-- No additional policies needed for user_profiles.
