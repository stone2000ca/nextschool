-- Create missing tables: family_journeys, school_journeys, chat_shortlists, photo_candidates
-- No FK constraints (mixed UUID/TEXT PK types across existing tables)

-- ─── family_journeys ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS family_journeys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL,
  chat_history_id TEXT,
  child_name TEXT,
  profile_label TEXT,
  current_phase TEXT DEFAULT 'UNDERSTAND' CHECK (current_phase IN ('UNDERSTAND', 'MATCH', 'EVALUATE', 'EXPERIENCE', 'DECIDE', 'ACT')),
  phase_history JSONB DEFAULT '[]'::JSONB,
  family_profile_id TEXT,
  brief_snapshot JSONB,
  brief_updated_at TIMESTAMPTZ,
  school_journeys JSONB DEFAULT '[]'::JSONB,
  consultant_id TEXT CHECK (consultant_id IN ('jackie', 'liam')),
  next_action TEXT,
  next_action_due TIMESTAMPTZ,
  next_action_type TEXT CHECK (next_action_type IN ('TOUR', 'COMPARE', 'APPLY', 'REVIEW', 'FOLLOWUP')),
  last_session_summary TEXT,
  total_sessions INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  is_stale BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  outcome TEXT CHECK (outcome IN ('ENROLLED', 'DEFERRED', 'ABANDONED')),
  outcome_school_id TEXT,
  outcome_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_family_journeys_user ON family_journeys(user_id);
CREATE INDEX idx_family_journeys_chat ON family_journeys(chat_history_id);

ALTER TABLE family_journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own family journeys"
  ON family_journeys FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can insert own family journeys"
  ON family_journeys FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can update own family journeys"
  ON family_journeys FOR UPDATE USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can delete own family journeys"
  ON family_journeys FOR DELETE USING (auth.uid()::TEXT = user_id);

CREATE TRIGGER set_family_journeys_updated_at
  BEFORE UPDATE ON family_journeys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── school_journeys ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS school_journeys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  family_journey_id TEXT NOT NULL,
  school_id TEXT NOT NULL,
  school_name TEXT NOT NULL,
  status TEXT DEFAULT 'shortlisted' CHECK (status IN ('shortlisted', 'removed', 'touring', 'visited')),
  tour_request_id TEXT,
  tour_date TIMESTAMPTZ,
  phase TEXT,
  match_score NUMERIC,
  added_at TIMESTAMPTZ NOT NULL,
  tour_prep_content TEXT,
  tour_prep_sent BOOLEAN DEFAULT FALSE,
  debrief_summary TEXT,
  debrief_sentiment TEXT CHECK (debrief_sentiment IN ('POSITIVE', 'MIXED', 'NEGATIVE')),
  ranking INTEGER,
  ranking_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_school_journeys_family ON school_journeys(family_journey_id);
CREATE INDEX idx_school_journeys_school ON school_journeys(school_id);

ALTER TABLE school_journeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own school journeys"
  ON school_journeys FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT
  ));
CREATE POLICY "Users can insert own school journeys"
  ON school_journeys FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT
  ));
CREATE POLICY "Users can update own school journeys"
  ON school_journeys FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT
  ));
CREATE POLICY "Users can delete own school journeys"
  ON school_journeys FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT
  ));

CREATE TRIGGER set_school_journeys_updated_at
  BEFORE UPDATE ON school_journeys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── chat_shortlists ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_shortlists (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  family_journey_id TEXT NOT NULL,
  school_id TEXT NOT NULL,
  added_at TIMESTAMPTZ NOT NULL,
  source TEXT CHECK (source IN ('manual', 'auto-match', 'restored')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_chat_shortlists_journey ON chat_shortlists(family_journey_id);
CREATE INDEX idx_chat_shortlists_school ON chat_shortlists(school_id);
CREATE UNIQUE INDEX idx_chat_shortlists_unique ON chat_shortlists(family_journey_id, school_id);

ALTER TABLE chat_shortlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own chat shortlists"
  ON chat_shortlists FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT
  ));
CREATE POLICY "Users can insert own chat shortlists"
  ON chat_shortlists FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT
  ));
CREATE POLICY "Users can update own chat shortlists"
  ON chat_shortlists FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT
  ));
CREATE POLICY "Users can delete own chat shortlists"
  ON chat_shortlists FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM family_journeys fj WHERE fj.id = family_journey_id AND fj.user_id = auth.uid()::TEXT
  ));

CREATE TRIGGER set_chat_shortlists_updated_at
  BEFORE UPDATE ON chat_shortlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── photo_candidates ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS photo_candidates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  school_id TEXT NOT NULL,
  school_name TEXT,
  image_url TEXT NOT NULL,
  page_url TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('website', 'google_maps')),
  alt_text TEXT,
  inferred_type TEXT NOT NULL CHECK (inferred_type IN ('hero', 'campus', 'classroom', 'sports', 'general')),
  width_attr INTEGER,
  height_attr INTEGER,
  file_size_bytes INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_as TEXT CHECK (approved_as IN ('headerPhoto', 'gallery')),
  reviewed_by_admin_id TEXT,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  batch_id TEXT NOT NULL,
  created_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_photo_candidates_school ON photo_candidates(school_id);
CREATE INDEX idx_photo_candidates_status ON photo_candidates(status);
CREATE INDEX idx_photo_candidates_batch ON photo_candidates(batch_id);

ALTER TABLE photo_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read approved photo candidates"
  ON photo_candidates FOR SELECT
  USING (status = 'approved');

CREATE TRIGGER set_photo_candidates_updated_at
  BEFORE UPDATE ON photo_candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
