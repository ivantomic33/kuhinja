-- Registration stores consent in Auth metadata until a verified user session
-- can insert it through the existing owner-only legal_consents RLS policies.
drop trigger if exists on_auth_user_legal_consents on auth.users;
drop function if exists public.record_signup_legal_consents();
