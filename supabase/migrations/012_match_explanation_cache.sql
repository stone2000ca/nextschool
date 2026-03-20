-- Migration 012: Match Explanation Cache
-- Caches AI-generated match explanations per family+school pair
-- to avoid redundant LLM calls when profile hasn't changed.

CREATE TABLE IF NOT EXISTS match_explanation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_profile_id UUID NOT NULL REFERENCES family_profiles(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  explanations JSONB NOT NULL DEFAULT '[]'::jsonb,
  profile_hash TEXT NOT NULL,
  stale BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One cache row per family+school pair
CREATE UNIQUE INDEX IF NOT EXISTS idx_mec_family_school
  ON match_explanation_cache(family_profile_id, school_id);

-- Fast lookup by profile hash
CREATE INDEX IF NOT EXISTS idx_mec_profile_hash
  ON match_explanation_cache(profile_hash);

-- Fast lookup of non-stale rows for a profile
CREATE INDEX IF NOT EXISTS idx_mec_family_stale
  ON match_explanation_cache(family_profile_id, stale);

-- RLS: server-side writes only; authenticated users can read their own via family_profiles join
ALTER TABLE match_explanation_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own match explanation cache"
  ON match_explanation_cache FOR SELECT
  USING (
    family_profile_id IN (
      SELECT id FROM family_profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access on match_explanation_cache"
  ON match_explanation_cache FOR ALL
  USING (auth.role() = 'service_role');

-- Trigger: auto-mark cache rows stale when hash-relevant profile fields change
CREATE OR REPLACE FUNCTION mark_match_explanations_stale()
RETURNS TRIGGER AS $$
BEGIN
  -- Compare hash-relevant fields between OLD and NEW
  IF (
    OLD.child_grade IS DISTINCT FROM NEW.child_grade OR
    OLD.max_tuition IS DISTINCT FROM NEW.max_tuition OR
    OLD.priorities IS DISTINCT FROM NEW.priorities OR
    OLD.curriculum_preference IS DISTINCT FROM NEW.curriculum_preference OR
    OLD.boarding_preference IS DISTINCT FROM NEW.boarding_preference OR
    OLD.location_area IS DISTINCT FROM NEW.location_area OR
    OLD.dealbreakers IS DISTINCT FROM NEW.dealbreakers OR
    OLD.learning_style IS DISTINCT FROM NEW.learning_style OR
    OLD.interests IS DISTINCT FROM NEW.interests
  ) THEN
    UPDATE match_explanation_cache
    SET stale = true, updated_at = now()
    WHERE family_profile_id = NEW.id AND stale = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_mark_match_explanations_stale
  AFTER UPDATE ON family_profiles
  FOR EACH ROW
  EXECUTE FUNCTION mark_match_explanations_stale();
