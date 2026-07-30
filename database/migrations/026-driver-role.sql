-- 026-driver-role.sql
-- Add 'driver' as a valid profile role and migrate existing shipper accounts

-- Drop existing constraint and add driver to the allowed roles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('carrier', 'broker', 'shipper', 'admin', 'driver'));

-- Migrate existing shipper accounts to driver
UPDATE profiles SET role = 'driver' WHERE role = 'shipper';
