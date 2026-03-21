-- Migration: Create user_profiles and public.users tables
-- These tables were referenced by the handle_new_user() trigger (migration 006)
-- but never created in the repository migrations (001-004 are missing).
-- This migration creates both tables, adds RLS policies, and backfills
-- rows for any existing auth.users that lack a profile.
--
-- NOTE: The existing public.users table has UUID id (not TEXT).
-- Backfill queries handle the type difference with explicit casts.

-- ============================================================
-- 1. Create user_profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  full_name     TEXT DEFAULT '',
  role          TEXT NOT NULL DEFAULT 'user',
  subscription_plan TEXT NOT NULL DEFAULT 'free',
  token_balance INTEGER NOT NULL DEFAULT 3,
  max_sessions  INTEGER NOT NULL DEFAULT 3,
  stripe_customer_id TEXT,
  last_signed_on TIMESTAMPTZ,
  profile_region TEXT,
  email_notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. Create public.users table (role lookups, referenced by trigger)
--    Skipped if already exists (existing table has UUID id)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id         TEXT PRIMARY KEY,
  email      TEXT,
  role       TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. updated_at trigger function (used by multiple tables)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- 4. RLS policies for user_profiles
-- ============================================================
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own profile"
    ON public.user_profiles FOR SELECT
    USING (auth.uid()::TEXT = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile"
    ON public.user_profiles FOR UPDATE
    USING (auth.uid()::TEXT = id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access on user_profiles"
    ON public.user_profiles FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 5. RLS policies for public.users
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own users row"
    ON public.users FOR SELECT
    USING (auth.uid()::TEXT = id::TEXT);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role full access on users"
    ON public.users FOR ALL
    USING (auth.role() = 'service_role');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 6. Backfill: create user_profiles for existing auth.users
--    All existing users default to subscription_plan = 'free'
-- ============================================================
INSERT INTO public.user_profiles (id, email, full_name, role, subscription_plan, token_balance, max_sessions, created_at, updated_at)
SELECT
  au.id::TEXT,
  au.email,
  COALESCE(au.raw_user_meta_data ->> 'full_name', ''),
  'user',
  'free',
  3,
  3,
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.id = au.id::TEXT
)
ON CONFLICT (id) DO NOTHING;

-- Backfill public.users (existing table has UUID id column)
INSERT INTO public.users (id, email, role, created_at, updated_at)
SELECT
  au.id,
  au.email,
  'user',
  au.created_at,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.users u WHERE u.id = au.id
)
ON CONFLICT (id) DO NOTHING;
