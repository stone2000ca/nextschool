-- Safety net: ensure consultant_name column exists on session_events.
-- The column was defined in 001_initial_schema.sql but may be missing
-- in production if the table was created before that migration was applied.
-- Some client callers historically passed consultant_name as a top-level
-- field, causing PGRST204 errors when the column didn't exist.
ALTER TABLE session_events ADD COLUMN IF NOT EXISTS consultant_name TEXT;
