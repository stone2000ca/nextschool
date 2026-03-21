-- E54-S2: Add enrichment_status to schools for polling during onboard
ALTER TABLE schools ADD COLUMN IF NOT EXISTS enrichment_status text DEFAULT NULL;
