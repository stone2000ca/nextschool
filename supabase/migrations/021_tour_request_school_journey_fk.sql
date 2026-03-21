-- Create tour_requests table scoped to school_journey (not user-level)
-- Ownership: user -> family_journey -> school_journey -> tour_request

CREATE TABLE IF NOT EXISTS tour_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  school_journey_id TEXT,                    -- soft FK to school_journeys
  school_id TEXT NOT NULL,                   -- which school
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'pending',             -- pending | confirmed | cancelled
  parent_name TEXT,
  parent_email TEXT,
  tour_type TEXT,                            -- in_person | virtual
  message TEXT,
  preferred_date TIMESTAMPTZ,
  "preferredDateAlt" TIMESTAMPTZ,
  "eventId" TEXT,
  "numberOfVisitors" INTEGER,
  child_grade INTEGER,
  "specialRequests" TEXT,
  conversation_id TEXT,
  max_tuition NUMERIC,
  "prioritiesSnapshot" TEXT,
  "boardingPreference" TEXT,
  "profileSnapshotAt" TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for school_journey lookups
CREATE INDEX IF NOT EXISTS idx_tour_requests_school_journey
  ON tour_requests(school_journey_id);

-- Index for school lookups (used by school admin inbox)
CREATE INDEX IF NOT EXISTS idx_tour_requests_school
  ON tour_requests(school_id);

-- RLS: service role manages tour requests (created server-side via admin client)
ALTER TABLE tour_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on tour_requests"
  ON tour_requests FOR ALL
  USING (auth.role() = 'service_role');
