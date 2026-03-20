-- E51-S4A: Email queue for visit-related triggered emails
-- Supports T-7, T-1, T+1, T+3 emails relative to visit_date

CREATE TABLE IF NOT EXISTS email_queue (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id       TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visit_record_id TEXT NOT NULL REFERENCES visit_records(id) ON DELETE CASCADE,
  email_type    TEXT NOT NULL CHECK (email_type IN ('visit_prep_t7', 'visit_reminder_t1', 'visit_debrief_t1', 'visit_followup_t3')),
  scheduled_at  TIMESTAMPTZ NOT NULL,
  sent_at       TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'cancelled', 'failed')),
  error_message TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_queue_status_scheduled ON email_queue(status, scheduled_at);
CREATE INDEX idx_email_queue_user ON email_queue(user_id);
CREATE INDEX idx_email_queue_visit ON email_queue(visit_record_id);

ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;

-- Service role only — emails are managed server-side
-- No public/anon policies

CREATE TRIGGER set_email_queue_updated_at
  BEFORE UPDATE ON email_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add email_notifications_enabled to user_profiles (default true)
-- S4B will add a UI toggle for this; for now it's always on
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT true;
