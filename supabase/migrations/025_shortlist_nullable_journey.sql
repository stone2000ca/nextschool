-- Make family_journey_id nullable so shortlists work before a journey is created
ALTER TABLE chat_shortlists ALTER COLUMN family_journey_id DROP NOT NULL;

-- Update RLS policies to also allow access via conversation_id ownership
-- (current policies only check family_journey_id which can now be null)
DROP POLICY IF EXISTS "Users can read own chat shortlists" ON chat_shortlists;
DROP POLICY IF EXISTS "Users can insert own chat shortlists" ON chat_shortlists;
DROP POLICY IF EXISTS "Users can update own chat shortlists" ON chat_shortlists;
DROP POLICY IF EXISTS "Users can delete own chat shortlists" ON chat_shortlists;

CREATE POLICY "Users can read own chat shortlists" ON chat_shortlists FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT)
    OR EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()::TEXT)
  );

CREATE POLICY "Users can insert own chat shortlists" ON chat_shortlists FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT)
    OR EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()::TEXT)
  );

CREATE POLICY "Users can update own chat shortlists" ON chat_shortlists FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT)
    OR EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()::TEXT)
  );

CREATE POLICY "Users can delete own chat shortlists" ON chat_shortlists FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT)
    OR EXISTS (SELECT 1 FROM conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()::TEXT)
  );
