-- NextSchool Initial Schema
-- Migrated from Base44 entities to PostgreSQL/Supabase
-- All tables use TEXT primary keys to match Base44's string IDs

-- ============================================================================
-- 1. schools
-- ============================================================================
CREATE TABLE IF NOT EXISTS schools (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name TEXT,
  slug TEXT UNIQUE,
  city TEXT,
  province_state TEXT,
  region TEXT,
  country TEXT DEFAULT 'Canada',
  status TEXT DEFAULT 'active',
  claim_status TEXT,
  lowest_grade INTEGER,
  highest_grade INTEGER,
  tuition NUMERIC,
  day_tuition NUMERIC,
  day_tuition_min NUMERIC,
  day_tuition_max NUMERIC,
  boarding_tuition NUMERIC,
  boarding_tuition_min NUMERIC,
  boarding_tuition_max NUMERIC,
  currency TEXT DEFAULT 'CAD',
  gender_policy TEXT,
  school_type_label TEXT,
  school_type TEXT,
  curriculum TEXT[],
  specializations TEXT[],
  arts_programs TEXT[],
  sports_programs TEXT[],
  faith_based TEXT,
  boarding_available BOOLEAN DEFAULT FALSE,
  distance_km NUMERIC,
  lat NUMERIC,
  lng NUMERIC,
  header_photo_url TEXT,
  logo_url TEXT,
  hero_image TEXT,
  photo_gallery JSONB DEFAULT '[]'::JSONB,
  website TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  description TEXT,
  mission_statement TEXT,
  living_arrangements TEXT,
  languages_of_instruction TEXT[],
  avg_class_size NUMERIC,
  student_teacher_ratio NUMERIC,
  founded TEXT,
  enrollment INTEGER,
  virtual_tour_url TEXT,
  campus_feel TEXT,
  financial_aid_available BOOLEAN,
  financial_aid_pct NUMERIC,
  median_aid_amount NUMERIC,
  day_admission_deadline TEXT,
  boarding_admission_deadline TEXT,
  admission_requirements TEXT,
  entrance_requirements TEXT,
  application_process TEXT,
  acceptance_rate NUMERIC,
  clubs TEXT[],
  facilities TEXT[],
  special_ed_programs TEXT[],
  accreditations TEXT[],
  values TEXT[],
  teaching_philosophy TEXT,
  highlights TEXT[],
  grades_served TEXT,
  school_tier TEXT,
  verified BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schools_slug ON schools(slug);
CREATE INDEX IF NOT EXISTS idx_schools_status ON schools(status);
CREATE INDEX IF NOT EXISTS idx_schools_province ON schools(province_state);

-- ============================================================================
-- 2. user_profiles (extends auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  subscription_plan TEXT,
  token_balance INTEGER DEFAULT 3,
  max_sessions INTEGER DEFAULT 3,
  stripe_customer_id TEXT,
  last_signed_on TIMESTAMPTZ,
  profile_region TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 3. conversations (was ChatHistory)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT,
  title TEXT,
  messages JSONB DEFAULT '[]'::JSONB,
  conversation_context JSONB DEFAULT '{}'::JSONB,
  is_active BOOLEAN DEFAULT TRUE,
  long_term_summary TEXT,
  short_term_context TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id);

-- ============================================================================
-- 4. chat_sessions
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  session_token TEXT,
  user_id TEXT,
  family_profile_id TEXT,
  chat_history_id TEXT,
  status TEXT DEFAULT 'active',
  consultant_selected TEXT,
  child_name TEXT,
  child_grade TEXT,
  location_area TEXT,
  max_tuition NUMERIC,
  priorities TEXT[],
  matched_schools JSONB DEFAULT '[]'::JSONB,
  profile_name TEXT,
  journey_id TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);

-- ============================================================================
-- 5. family_profiles
-- ============================================================================
CREATE TABLE IF NOT EXISTS family_profiles (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT,
  conversation_id TEXT,
  child_name TEXT,
  child_grade INTEGER,
  child_age INTEGER,
  gender TEXT,
  child_gender TEXT,
  location_area TEXT,
  location_lat NUMERIC,
  location_lng NUMERIC,
  max_tuition NUMERIC,
  interests TEXT[],
  priorities TEXT[],
  dealbreakers TEXT[],
  academic_strengths TEXT[],
  academic_struggles TEXT[],
  learning_differences TEXT[],
  personality_traits TEXT[],
  learning_style TEXT,
  curriculum_preference TEXT[],
  boarding_preference TEXT,
  commute_tolerance_minutes INTEGER,
  has_siblings BOOLEAN,
  sibling_details TEXT,
  timeline TEXT,
  onboarding_phase TEXT,
  onboarding_complete BOOLEAN DEFAULT FALSE,
  family_brief JSONB,
  conversation_family_profile JSONB,
  current_phase TEXT,
  school_gender_preference TEXT,
  school_gender_exclusions TEXT[],
  school_type_label TEXT,
  religious_preference TEXT,
  parent_notes TEXT[],
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_profiles_user ON family_profiles(user_id);

-- ============================================================================
-- 6. family_journeys
-- ============================================================================
CREATE TABLE IF NOT EXISTS family_journeys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT,
  child_name TEXT,
  profile_label TEXT,
  current_phase TEXT,
  phase_history JSONB DEFAULT '[]'::JSONB,
  family_profile_id TEXT,
  brief_snapshot JSONB,
  consultant_id TEXT,
  total_sessions INTEGER DEFAULT 1,
  is_archived BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMPTZ,
  next_action TEXT,
  last_session_summary TEXT,
  chat_history_id TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_family_journeys_user ON family_journeys(user_id);

-- ============================================================================
-- 7. school_journeys
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_journeys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  family_journey_id TEXT,
  school_id TEXT,
  school_name TEXT,
  status TEXT,
  added_at TIMESTAMPTZ,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_journeys_journey ON school_journeys(family_journey_id);

-- ============================================================================
-- 8. chat_shortlists
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_shortlists (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  family_journey_id TEXT,
  school_id TEXT,
  added_at TIMESTAMPTZ,
  source TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_shortlists_journey ON chat_shortlists(family_journey_id);

-- ============================================================================
-- 9. generated_artifacts
-- ============================================================================
CREATE TABLE IF NOT EXISTS generated_artifacts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  conversation_id TEXT,
  school_ids TEXT[],
  artifact_type TEXT,
  content JSONB,
  generated_at TIMESTAMPTZ,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_conversation ON generated_artifacts(conversation_id);

-- ============================================================================
-- 10. school_analyses
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_analyses (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT,
  conversation_id TEXT,
  school_id TEXT,
  deep_dive_analysis JSONB,
  visit_prep_kit JSONB,
  fit_re_evaluation JSONB,
  action_plan JSONB,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_analyses_user ON school_analyses(user_id);

-- ============================================================================
-- 11. school_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  school_id TEXT,
  event_type TEXT,
  title TEXT,
  date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  description TEXT,
  registration_url TEXT,
  virtual_url TEXT,
  capacity INTEGER,
  location TEXT,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT,
  source TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_events_school ON school_events(school_id);

-- ============================================================================
-- 12. school_claims
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_claims (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  school_id TEXT,
  claimant_name TEXT,
  claimant_email TEXT,
  verification_code TEXT,
  code_expires_at TIMESTAMPTZ,
  attempt_count INTEGER DEFAULT 0,
  locked_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  document_url TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 13. school_admins
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_admins (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  school_id TEXT,
  user_id TEXT,
  role TEXT DEFAULT 'admin',
  is_active BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_admins_user ON school_admins(user_id);
CREATE INDEX IF NOT EXISTS idx_school_admins_school ON school_admins(school_id);

-- ============================================================================
-- 14. school_inquiries
-- ============================================================================
CREATE TABLE IF NOT EXISTS school_inquiries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  parent_user_id TEXT,
  school_id TEXT,
  parent_name TEXT,
  parent_email TEXT,
  child_name TEXT,
  child_grade TEXT,
  message TEXT,
  inquiry_type TEXT DEFAULT 'general',
  status TEXT DEFAULT 'new',
  response TEXT,
  tour_status TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_inquiries_school ON school_inquiries(school_id);

-- ============================================================================
-- 15. user_memories
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_memories (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT,
  content TEXT,
  category TEXT,
  confidence NUMERIC,
  last_accessed TIMESTAMPTZ,
  source TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_memories_user ON user_memories(user_id);

-- ============================================================================
-- 16. blog_posts
-- ============================================================================
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title TEXT,
  slug TEXT UNIQUE,
  content TEXT,
  excerpt TEXT,
  author TEXT,
  category TEXT,
  tags TEXT[],
  cover_image TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  published_date TIMESTAMPTZ,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 17. feedback
-- ============================================================================
CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  tester_name TEXT,
  tester_email TEXT,
  consultant_used TEXT,
  what_were_you_hoping_to_find TEXT,
  did_you_find_it TEXT,
  what_frustrated_you TEXT,
  would_you_recommend TEXT,
  additional_comments TEXT,
  timestamp TIMESTAMPTZ,
  source TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 18. submissions
-- ============================================================================
CREATE TABLE IF NOT EXISTS submissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  school_name TEXT,
  city TEXT,
  province_state TEXT,
  website TEXT,
  contact_name TEXT,
  contact_email TEXT,
  school_type TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 19. disputes
-- ============================================================================
CREATE TABLE IF NOT EXISTS disputes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  school_id TEXT,
  claimant_name TEXT,
  claimant_email TEXT,
  reason TEXT,
  evidence_url TEXT,
  status TEXT DEFAULT 'pending',
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 20. session_events
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  event_type TEXT,
  consultant_name TEXT,
  session_id TEXT,
  timestamp TIMESTAMPTZ,
  metadata JSONB,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 21. token_transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS token_transactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT,
  action TEXT,
  tokens_deducted INTEGER,
  remaining_balance INTEGER,
  session_id TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 22. shared_shortlists
-- ============================================================================
CREATE TABLE IF NOT EXISTS shared_shortlists (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  hash TEXT UNIQUE,
  school_ids TEXT[],
  schools JSONB,
  generated_date TIMESTAMPTZ,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 23. testimonials
-- ============================================================================
CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  school_id TEXT,
  parent_name TEXT,
  content TEXT,
  rating INTEGER,
  is_visible BOOLEAN DEFAULT TRUE,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 24. tour_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS tour_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  parent_user_id TEXT,
  school_id TEXT,
  parent_name TEXT,
  parent_email TEXT,
  child_name TEXT,
  child_grade TEXT,
  preferred_date TEXT,
  preferred_time TEXT,
  message TEXT,
  status TEXT DEFAULT 'pending',
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 25. notes (was Notes/ResearchNote)
-- ============================================================================
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT,
  school_id TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);

-- ============================================================================
-- 26. email_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  recipient TEXT,
  subject TEXT,
  template TEXT,
  status TEXT,
  error TEXT,
  is_test BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 27. llm_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS llm_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  conversation_id TEXT,
  phase TEXT,
  model TEXT,
  prompt_summary TEXT,
  response_summary TEXT,
  token_count_in INTEGER,
  token_count_out INTEGER,
  latency_ms INTEGER,
  status TEXT,
  is_test BOOLEAN DEFAULT FALSE,
  full_prompt TEXT,
  full_response TEXT,
  error_message TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 28. search_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS search_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  query TEXT,
  input_filters JSONB,
  total_schools_passing_filters INTEGER,
  top_results JSONB,
  conversation_id TEXT,
  user_id TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 29. conversation_summaries
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  conversation_id TEXT,
  long_term_summary TEXT,
  short_term_context TEXT,
  extracted_preferences JSONB,
  child_grade TEXT,
  location TEXT,
  priorities TEXT[],
  region TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 30. photo_candidates
-- ============================================================================
CREATE TABLE IF NOT EXISTS photo_candidates (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  school_id TEXT,
  url TEXT,
  source TEXT,
  status TEXT DEFAULT 'pending',
  review_notes TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 31. enrichment_diffs
-- ============================================================================
CREATE TABLE IF NOT EXISTS enrichment_diffs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  school_id TEXT,
  field_name TEXT,
  old_value TEXT,
  new_value TEXT,
  source TEXT,
  status TEXT DEFAULT 'pending',
  reviewed_at TIMESTAMPTZ,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 32. import_runs
-- ============================================================================
CREATE TABLE IF NOT EXISTS import_runs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  file_name TEXT,
  total_rows INTEGER,
  imported INTEGER,
  skipped INTEGER,
  errors JSONB,
  status TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 33. visitor_logs
-- ============================================================================
CREATE TABLE IF NOT EXISTS visitor_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT,
  session_id TEXT,
  timestamp TIMESTAMPTZ,
  page TEXT,
  referrer TEXT,
  user_agent TEXT,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT now(),
  updated_date TIMESTAMPTZ DEFAULT now()
);
