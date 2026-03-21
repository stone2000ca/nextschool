-- Consolidate generated_artifacts into conversation_artifacts
-- generated_artifacts is legacy; all reads/writes now go to conversation_artifacts

-- 1. Make conversation_id nullable (comparison artifacts don't have one)
ALTER TABLE conversation_artifacts ALTER COLUMN conversation_id DROP NOT NULL;

-- 2. Add columns needed by code that previously wrote to generated_artifacts
ALTER TABLE conversation_artifacts ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE conversation_artifacts ADD COLUMN IF NOT EXISTS family_profile_id TEXT;
ALTER TABLE conversation_artifacts ADD COLUMN IF NOT EXISTS artifact_key TEXT;
ALTER TABLE conversation_artifacts ADD COLUMN IF NOT EXISTS school_name TEXT;
ALTER TABLE conversation_artifacts ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ;
ALTER TABLE conversation_artifacts ADD COLUMN IF NOT EXISTS status TEXT;

-- 3. Index for comparison cache lookups (family_profile_id + artifact_type)
CREATE INDEX IF NOT EXISTS idx_conversation_artifacts_family_profile
  ON conversation_artifacts(family_profile_id, artifact_type);

-- 4. Drop the legacy table
DROP TABLE IF EXISTS generated_artifacts;
