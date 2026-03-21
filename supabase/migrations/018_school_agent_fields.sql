-- E54-S1: Add AI enrichment tracking fields to schools table
ALTER TABLE schools ADD COLUMN IF NOT EXISTS verified_fields text[] DEFAULT '{}';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS ai_enriched_fields text[] DEFAULT '{}';
