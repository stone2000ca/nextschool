-- Add missing columns to chat_sessions table
-- These columns are required by the ChatSession create/update logic in
-- useMessageHandler and the Dashboard display in SchoolSearchProfile.
ALTER TABLE public.chat_sessions
  ADD COLUMN IF NOT EXISTS session_token text,
  ADD COLUMN IF NOT EXISTS family_profile_id text,
  ADD COLUMN IF NOT EXISTS chat_history_id text,
  ADD COLUMN IF NOT EXISTS consultant_selected text,
  ADD COLUMN IF NOT EXISTS child_name text,
  ADD COLUMN IF NOT EXISTS child_grade integer,
  ADD COLUMN IF NOT EXISTS location_area text,
  ADD COLUMN IF NOT EXISTS max_tuition numeric,
  ADD COLUMN IF NOT EXISTS priorities jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS matched_schools text,
  ADD COLUMN IF NOT EXISTS profile_name text,
  ADD COLUMN IF NOT EXISTS journey_id text,
  ADD COLUMN IF NOT EXISTS shortlisted_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_token text,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS learning_differences jsonb;
