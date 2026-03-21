-- 027: Rewire visit_records from chat_history to school_journey
--
-- visit_record was a child of conversations (chat_history_id FK) + auth.users (user_id FK).
-- Now it becomes a child of school_journeys (school_journey_id FK, ON DELETE CASCADE).
-- school_id and user_id are kept as denormalized read columns for dashboard queries,
-- but their FK constraints are dropped so deleting a conversation or user row
-- no longer cascades into visit_records.
--
-- email_queue already references visit_records(id) ON DELETE CASCADE,
-- so the cascade chain school_journey → visit_record → email_queue works naturally.

-- ─── 1. Add school_journey_id (nullable for backfill) ────────────────

ALTER TABLE visit_records
  ADD COLUMN IF NOT EXISTS school_journey_id TEXT
    REFERENCES school_journeys(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_visit_records_school_journey
  ON visit_records(school_journey_id);

-- ─── 2. Drop chat_history_id FK + column ─────────────────────────────

ALTER TABLE visit_records
  DROP CONSTRAINT IF EXISTS visit_records_chat_history_id_fkey;

ALTER TABLE visit_records
  DROP COLUMN IF EXISTS chat_history_id;

-- ─── 3. Drop user_id FK (keep column as denormalized read field) ─────

ALTER TABLE visit_records
  DROP CONSTRAINT IF EXISTS visit_records_user_id_fkey;

-- ─── 4. Drop school_id FK (keep column as denormalized read field) ───

ALTER TABLE visit_records
  DROP CONSTRAINT IF EXISTS visit_records_school_id_fkey;

-- ─── 5. Remove NOT NULL on user_id and school_id ─────────────────────
-- These are now denormalized copies; the source of truth is school_journey.
-- Existing rows already have values, but new rows may rely on backfill.

ALTER TABLE visit_records ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE visit_records ALTER COLUMN school_id DROP NOT NULL;
