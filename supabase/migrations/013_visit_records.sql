-- Visit records: track school visits (open houses, tours, info nights, etc.)

CREATE TABLE IF NOT EXISTS visit_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  chat_history_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('open_house', 'private_tour', 'info_night', 'virtual', 'other')),
  visit_date DATE,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'debrief_pending', 'completed')),
  impression TEXT CHECK (impression IN ('loved_it', 'mixed', 'not_for_us')),
  standout_moments TEXT,
  concerns TEXT,
  would_visit_again TEXT CHECK (would_visit_again IN ('yes', 'maybe', 'no')),
  prep_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_visit_records_user ON visit_records(user_id);
CREATE INDEX idx_visit_records_user_school ON visit_records(user_id, school_id);

ALTER TABLE visit_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own visit records"
  ON visit_records FOR SELECT USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can insert own visit records"
  ON visit_records FOR INSERT WITH CHECK (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can update own visit records"
  ON visit_records FOR UPDATE USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Users can delete own visit records"
  ON visit_records FOR DELETE USING (auth.uid()::TEXT = user_id);

CREATE TRIGGER set_visit_records_updated_at
  BEFORE UPDATE ON visit_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
