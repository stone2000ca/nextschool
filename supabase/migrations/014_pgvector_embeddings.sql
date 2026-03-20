-- 014: Enable pgvector and add embedding columns for semantic search
-- Run manually via: supabase db push (or paste into Supabase SQL editor)

-- 1) Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2) Add embedding columns to existing tables
ALTER TABLE schools
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE school_analyses
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE visit_records
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3) Create conversation_summaries table if it doesn't exist
-- (Referenced in entities-server.ts but may not have a migration)
CREATE TABLE IF NOT EXISTS conversation_summaries (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id TEXT NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  summary TEXT,
  message_count INTEGER DEFAULT 0,
  last_summarized_at TIMESTAMPTZ,
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add embedding column if table already exists but column doesn't
ALTER TABLE conversation_summaries
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 4) IVFFlat indexes for approximate nearest-neighbor search
-- Note: IVFFlat requires at least some rows to build lists.
-- Using lists=100 as a reasonable default; tune based on row count.
-- These indexes use cosine distance operator (<=>).

CREATE INDEX IF NOT EXISTS idx_schools_embedding
  ON schools USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_school_analyses_embedding
  ON school_analyses USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_visit_records_embedding
  ON visit_records USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_embedding
  ON conversation_summaries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- 5) RLS policies for conversation_summaries (if table was just created)
ALTER TABLE conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Drop-if-exists to make migration idempotent
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversation_summaries'
      AND policyname = 'Users can read own conversation summaries'
  ) THEN
    CREATE POLICY "Users can read own conversation summaries"
      ON conversation_summaries FOR SELECT
      USING (auth.uid()::TEXT = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversation_summaries'
      AND policyname = 'Users can insert own conversation summaries'
  ) THEN
    CREATE POLICY "Users can insert own conversation summaries"
      ON conversation_summaries FOR INSERT
      WITH CHECK (auth.uid()::TEXT = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'conversation_summaries'
      AND policyname = 'Users can update own conversation summaries'
  ) THEN
    CREATE POLICY "Users can update own conversation summaries"
      ON conversation_summaries FOR UPDATE
      USING (auth.uid()::TEXT = user_id);
  END IF;
END $$;

-- Index on conversation_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conv
  ON conversation_summaries(conversation_id);
