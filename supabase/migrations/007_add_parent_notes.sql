-- E41-S4: Add parent_notes column to family_profiles for soft signal capture
ALTER TABLE family_profiles ADD COLUMN IF NOT EXISTS parent_notes jsonb DEFAULT '[]';
