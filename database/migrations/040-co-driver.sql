-- 040: Add co-driver (second driver) support for team driving
ALTER TABLE loads ADD COLUMN IF NOT EXISTS second_driver_id UUID REFERENCES profiles(id);

-- Index for fast lookups by second driver
CREATE INDEX IF NOT EXISTS idx_loads_second_driver_id ON loads(second_driver_id) WHERE second_driver_id IS NOT NULL;
