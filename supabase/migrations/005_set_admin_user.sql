-- Set mrjamesshi@gmail.com as admin
-- Insert into public.users if not exists, then set role to admin
INSERT INTO public.users (id, email, role, created_at, updated_at)
SELECT id, email, 'admin', now(), now()
FROM auth.users
WHERE email = 'mrjamesshi@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin', updated_at = now();
