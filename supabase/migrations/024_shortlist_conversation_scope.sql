-- Scope chat_shortlists directly to conversations instead of relying on
-- the fragile family_journeys.chat_history_id derivation chain.
-- This fixes the shortlist bleed bug where switching chats shows the wrong shortlist.

-- 1. Add conversation_id column
ALTER TABLE chat_shortlists ADD COLUMN IF NOT EXISTS conversation_id TEXT;

-- 2. Index for efficient conversation-scoped queries
CREATE INDEX IF NOT EXISTS idx_chat_shortlists_conversation ON chat_shortlists(conversation_id);

-- 3. Backfill: derive conversation_id from family_journeys.chat_history_id for existing rows
UPDATE chat_shortlists cs
SET conversation_id = fj.chat_history_id
FROM family_journeys fj
WHERE cs.family_journey_id = fj.id
  AND cs.conversation_id IS NULL
  AND fj.chat_history_id IS NOT NULL;

-- 4. Deduplicate: keep only the newest record per (conversation_id, school_id)
DELETE FROM chat_shortlists
WHERE conversation_id IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (conversation_id, school_id) id
    FROM chat_shortlists
    WHERE conversation_id IS NOT NULL
    ORDER BY conversation_id, school_id, created_at DESC
  );

-- 5. Remove orphaned records with no conversation_id (can't be scoped)
DELETE FROM chat_shortlists WHERE conversation_id IS NULL;

-- 6. Replace unique constraint: scope to conversation instead of journey
DROP INDEX IF EXISTS idx_chat_shortlists_unique;
CREATE UNIQUE INDEX idx_chat_shortlists_unique ON chat_shortlists(conversation_id, school_id);
