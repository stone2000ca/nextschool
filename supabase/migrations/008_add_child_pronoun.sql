-- Add child_pronoun column to family_profiles for guided intro pronoun selection
ALTER TABLE family_profiles ADD COLUMN IF NOT EXISTS child_pronoun TEXT DEFAULT NULL;
