-- Set mrjamesshi@gmail.com as admin
-- This updates the user_profiles record for James to have admin role
UPDATE user_profiles
SET role = 'admin', updated_at = now()
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'mrjamesshi@gmail.com'
);
