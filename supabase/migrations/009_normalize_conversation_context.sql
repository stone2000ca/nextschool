-- Migration: Normalize conversation_context JSONB into discrete tables
-- Phase 1a: Create 3 new tables (additive only, no changes to existing tables)

-- ═══════════════════════════════════════════════════════════════════════
-- 1. conversation_state — State machine + session metadata
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversation_state (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,

  -- State machine
  state TEXT NOT NULL DEFAULT 'WELCOME',
  resume_view TEXT,
  brief_status TEXT,

  -- Extracted family preferences (denormalized for fast access)
  child_name TEXT,
  child_grade INTEGER,
  location_area TEXT,
  region TEXT,
  max_tuition INTEGER,
  priorities TEXT[] DEFAULT '{}',
  learning_differences TEXT[] DEFAULT '{}',

  -- Location resolution
  resolved_lat DOUBLE PRECISION,
  resolved_lng DOUBLE PRECISION,

  -- Deep dive tracking
  last_deep_dive_school_id TEXT,
  deep_dive_mode TEXT,
  selected_school_id TEXT,
  previous_school_id TEXT,

  -- Debrief mode
  debrief_school_id TEXT,
  debrief_question_queue TEXT[] DEFAULT '{}',
  debrief_questions_asked TEXT[] DEFAULT '{}',
  debrief_mode TEXT,

  -- Counters & flags
  turn_count INTEGER DEFAULT 0,
  brief_edit_count INTEGER DEFAULT 0,
  tier1_completed_turn INTEGER,
  auto_refreshed BOOLEAN DEFAULT false,

  -- Journey linkage
  journey_id TEXT,
  family_journey_id TEXT,

  -- Session linkage
  chat_session_id TEXT,
  consultant TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(conversation_id)
);

CREATE INDEX idx_conversation_state_user ON conversation_state(user_id);
CREATE INDEX idx_conversation_state_conv ON conversation_state(conversation_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. conversation_schools — School references per conversation
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversation_schools (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'search',
  rank INTEGER,
  is_current_results BOOLEAN DEFAULT true,
  added_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(conversation_id, school_id, source)
);

CREATE INDEX idx_conversation_schools_conv ON conversation_schools(conversation_id);
CREATE INDEX idx_conversation_schools_school ON conversation_schools(school_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 3. conversation_artifacts — Unified artifact storage
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS conversation_artifacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  school_id UUID REFERENCES schools(id) ON DELETE SET NULL,

  artifact_type TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  is_locked BOOLEAN DEFAULT false,
  version TEXT DEFAULT 'V1',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(conversation_id, school_id, artifact_type)
);

CREATE INDEX idx_conversation_artifacts_conv ON conversation_artifacts(conversation_id);
CREATE INDEX idx_conversation_artifacts_user ON conversation_artifacts(user_id);
CREATE INDEX idx_conversation_artifacts_school ON conversation_artifacts(school_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 4. RLS Policies
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE conversation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_artifacts ENABLE ROW LEVEL SECURITY;

-- conversation_state: user owns their rows directly via user_id
CREATE POLICY "Users manage own conversation_state"
  ON conversation_state FOR ALL
  USING (auth.uid()::TEXT = user_id);

-- conversation_schools: ownership derived from parent conversation
CREATE POLICY "Users manage own conversation_schools"
  ON conversation_schools FOR ALL
  USING (
    conversation_id IN (
      SELECT id FROM conversations WHERE user_id = auth.uid()::TEXT
    )
  );

-- conversation_artifacts: user owns their rows directly via user_id
CREATE POLICY "Users manage own conversation_artifacts"
  ON conversation_artifacts FOR ALL
  USING (auth.uid()::TEXT = user_id);

-- ═══════════════════════════════════════════════════════════════════════
-- 5. updated_at trigger (reuse pattern from existing tables)
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_conversation_state_updated_at
  BEFORE UPDATE ON conversation_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_conversation_artifacts_updated_at
  BEFORE UPDATE ON conversation_artifacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
