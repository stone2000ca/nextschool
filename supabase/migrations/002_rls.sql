-- Row Level Security policies for NextSchool

-- Enable RLS on all tables
ALTER TABLE schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_shortlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE tour_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrichment_diffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PUBLIC READ tables
-- ============================================================================

-- Schools: public read, admin write
CREATE POLICY "Schools are publicly readable" ON schools FOR SELECT USING (true);
CREATE POLICY "Service role can manage schools" ON schools FOR ALL USING (auth.role() = 'service_role');

-- Blog posts: public read published
CREATE POLICY "Published blog posts are public" ON blog_posts FOR SELECT USING (is_published = true);
CREATE POLICY "Service role can manage blog posts" ON blog_posts FOR ALL USING (auth.role() = 'service_role');

-- School events: public read active
CREATE POLICY "Active school events are public" ON school_events FOR SELECT USING (is_active = true);
CREATE POLICY "Service role can manage school events" ON school_events FOR ALL USING (auth.role() = 'service_role');

-- Testimonials: public read visible
CREATE POLICY "Visible testimonials are public" ON testimonials FOR SELECT USING (is_visible = true);
CREATE POLICY "Service role can manage testimonials" ON testimonials FOR ALL USING (auth.role() = 'service_role');

-- Shared shortlists: public read
CREATE POLICY "Shared shortlists are public" ON shared_shortlists FOR SELECT USING (true);
CREATE POLICY "Service role can manage shared shortlists" ON shared_shortlists FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- USER-SCOPED tables
-- ============================================================================

-- User profiles: own row only
CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid()::TEXT = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid()::TEXT = id);
CREATE POLICY "Service role can manage user profiles" ON user_profiles FOR ALL USING (auth.role() = 'service_role');

-- Conversations
CREATE POLICY "Users can manage own conversations" ON conversations FOR ALL USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Service role can manage conversations" ON conversations FOR ALL USING (auth.role() = 'service_role');

-- Chat sessions
CREATE POLICY "Users can manage own chat sessions" ON chat_sessions FOR ALL USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Service role can manage chat sessions" ON chat_sessions FOR ALL USING (auth.role() = 'service_role');

-- Family profiles
CREATE POLICY "Users can manage own family profiles" ON family_profiles FOR ALL USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Service role can manage family profiles" ON family_profiles FOR ALL USING (auth.role() = 'service_role');

-- Family journeys
CREATE POLICY "Users can manage own family journeys" ON family_journeys FOR ALL USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Service role can manage family journeys" ON family_journeys FOR ALL USING (auth.role() = 'service_role');

-- Notes
CREATE POLICY "Users can manage own notes" ON notes FOR ALL USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Service role can manage notes" ON notes FOR ALL USING (auth.role() = 'service_role');

-- User memories
CREATE POLICY "Users can manage own memories" ON user_memories FOR ALL USING (auth.uid()::TEXT = user_id);
CREATE POLICY "Service role can manage user memories" ON user_memories FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- SERVICE ROLE ONLY tables (logging, internal)
-- ============================================================================

CREATE POLICY "Service role manages school journeys" ON school_journeys FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages chat shortlists" ON chat_shortlists FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages generated artifacts" ON generated_artifacts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages school analyses" ON school_analyses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages school claims" ON school_claims FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages school admins" ON school_admins FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages school inquiries" ON school_inquiries FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages feedback" ON feedback FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages submissions" ON submissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages disputes" ON disputes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages session events" ON session_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages token transactions" ON token_transactions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages tour requests" ON tour_requests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages email logs" ON email_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages llm logs" ON llm_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages search logs" ON search_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages conversation summaries" ON conversation_summaries FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages photo candidates" ON photo_candidates FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages enrichment diffs" ON enrichment_diffs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages import runs" ON import_runs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role manages visitor logs" ON visitor_logs FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to create feedback and submissions
CREATE POLICY "Anyone can create feedback" ON feedback FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can create submissions" ON submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Authenticated users can create tour requests" ON tour_requests FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated users can create school inquiries" ON school_inquiries FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to read their own shortlists and journeys via service role
-- (frontend uses entity adapter which goes through API routes with service role)
