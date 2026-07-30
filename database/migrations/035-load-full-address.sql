-- 035: Add full address columns to loads for gated visibility
-- Street + zip stored but only shown after load is booked

ALTER TABLE loads ADD COLUMN IF NOT EXISTS origin_address text;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS origin_zip text;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS dest_address text;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS dest_zip text;
