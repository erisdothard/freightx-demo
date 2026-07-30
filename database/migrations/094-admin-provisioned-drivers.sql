-- ─────────────────────────────────────────────────────────────
-- Migration 094: Admin-Provisioned Driver Onboarding
-- Adds carrier_id + status to profiles, updates handle_new_user
-- trigger to read these from user metadata, adds 'driver' to
-- the profiles role CHECK constraint.
-- ─────────────────────────────────────────────────────────────

-- 1. Add 'driver' to profiles role CHECK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('carrier','broker','shipper','admin','driver'));

-- 2. Add carrier_id (link driver → carrier company)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS carrier_id UUID REFERENCES companies(id);
CREATE INDEX IF NOT EXISTS idx_profiles_carrier_id ON profiles(carrier_id);

-- 3. Add status column (invited → active → suspended → deactivated)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('invited','active','suspended','deactivated'));

-- 4. Update handle_new_user() to read carrier_id + status from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, carrier_id, status)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'carrier'),
    (new.raw_user_meta_data->>'carrier_id')::uuid,
    coalesce(new.raw_user_meta_data->>'status', 'active')
  )
  ON CONFLICT (id) DO UPDATE SET
    carrier_id = EXCLUDED.carrier_id,
    status = EXCLUDED.status;
  RETURN new;
END;
$$;
