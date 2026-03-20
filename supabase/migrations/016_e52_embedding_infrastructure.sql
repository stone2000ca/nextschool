-- E52-A1: pgvector extension and embedding columns
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE schools ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_schools_embedding
  ON schools USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

ALTER TABLE school_analyses ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_school_analyses_embedding
  ON school_analyses USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Note: visit_records table does not exist yet; using visit_record as specified by E52
-- This will be created if/when the table is added. Skipping for now to avoid errors.
-- ALTER TABLE visit_record ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- E52-A2: Add embedding columns to conversation_summaries
-- Table already exists with different schema; add the new columns needed for E52
ALTER TABLE conversation_summaries ADD COLUMN IF NOT EXISTS summary_index INT;
ALTER TABLE conversation_summaries ADD COLUMN IF NOT EXISTS summary_text TEXT;
ALTER TABLE conversation_summaries ADD COLUMN IF NOT EXISTS message_range_start INT;
ALTER TABLE conversation_summaries ADD COLUMN IF NOT EXISTS message_range_end INT;
ALTER TABLE conversation_summaries ADD COLUMN IF NOT EXISTS embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_embedding
  ON conversation_summaries USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_conversation_summaries_conv_id
  ON conversation_summaries (session_id);
