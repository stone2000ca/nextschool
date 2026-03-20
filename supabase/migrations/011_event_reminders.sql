-- Phase 5: Migrate event reminders from localStorage to Supabase
-- Replaces the 'ns_event_reminders' localStorage key

CREATE TABLE IF NOT EXISTS event_reminders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  school_name TEXT,
  event_title TEXT,
  event_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate reminders for same user+event
CREATE UNIQUE INDEX idx_event_reminders_user_event
  ON event_reminders(user_id, event_id);

-- RLS: users access only their own reminders
ALTER TABLE event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reminders"
  ON event_reminders FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert own reminders"
  ON event_reminders FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete own reminders"
  ON event_reminders FOR DELETE
  USING (auth.uid()::TEXT = user_id);
