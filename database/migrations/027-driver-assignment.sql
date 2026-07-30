-- 027-driver-assignment.sql
-- Link drivers to loads and trucks via profile references

-- Add assigned_driver_id to loads
ALTER TABLE loads ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_loads_assigned_driver ON loads(assigned_driver_id);

-- Add driver_id to trucks (link to driver profile instead of string fields)
ALTER TABLE trucks ADD COLUMN IF NOT EXISTS driver_id UUID REFERENCES profiles(id);
CREATE INDEX IF NOT EXISTS idx_trucks_driver_id ON trucks(driver_id);

-- RLS: drivers can view their assigned loads
CREATE POLICY "driver_view_assigned" ON loads
  FOR SELECT USING (assigned_driver_id = auth.uid());

-- RLS: drivers can update their assigned loads (status changes, etc.)
CREATE POLICY "driver_update_assigned" ON loads
  FOR UPDATE USING (assigned_driver_id = auth.uid());
