-- Migration 049: Enterprise Load Details Enhancement
-- Adds comprehensive contact information, appointment times, and freight details
-- for awarded/active loads while maintaining privacy on posted loads

-- Contact Information
ALTER TABLE loads
  ADD COLUMN shipper_name TEXT,
  ADD COLUMN shipper_contact_name TEXT,
  ADD COLUMN shipper_contact_phone TEXT,
  ADD COLUMN shipper_contact_email TEXT,
  ADD COLUMN receiver_name TEXT,
  ADD COLUMN receiver_contact_name TEXT,
  ADD COLUMN receiver_contact_phone TEXT,
  ADD COLUMN receiver_contact_email TEXT;

-- Appointment Times
ALTER TABLE loads
  ADD COLUMN pickup_appt_start TIMESTAMPTZ,
  ADD COLUMN pickup_appt_end TIMESTAMPTZ,
  ADD COLUMN delivery_appt_start TIMESTAMPTZ,
  ADD COLUMN delivery_appt_end TIMESTAMPTZ;

-- Freight Details
ALTER TABLE loads
  ADD COLUMN pieces_count INTEGER,
  ADD COLUMN pallets_count INTEGER,
  ADD COLUMN length_in INTEGER,
  ADD COLUMN width_in INTEGER,
  ADD COLUMN height_in INTEGER,
  ADD COLUMN stackable BOOLEAN DEFAULT TRUE,
  ADD COLUMN special_instructions TEXT,
  ADD COLUMN loading_notes TEXT,  -- Dock info, gate codes, etc.
  ADD COLUMN delivery_notes TEXT;

-- Indexes for searching/filtering
CREATE INDEX idx_loads_shipper_name ON loads(shipper_name) WHERE shipper_name IS NOT NULL;
CREATE INDEX idx_loads_receiver_name ON loads(receiver_name) WHERE receiver_name IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN loads.shipper_name IS 'Company name of the shipper/pickup location';
COMMENT ON COLUMN loads.shipper_contact_name IS 'Contact person at pickup location';
COMMENT ON COLUMN loads.shipper_contact_phone IS 'Phone number for pickup location';
COMMENT ON COLUMN loads.shipper_contact_email IS 'Email for pickup location';
COMMENT ON COLUMN loads.receiver_name IS 'Company name of the receiver/delivery location';
COMMENT ON COLUMN loads.receiver_contact_name IS 'Contact person at delivery location';
COMMENT ON COLUMN loads.receiver_contact_phone IS 'Phone number for delivery location';
COMMENT ON COLUMN loads.receiver_contact_email IS 'Email for delivery location';
COMMENT ON COLUMN loads.pickup_appt_start IS 'Pickup appointment window start time';
COMMENT ON COLUMN loads.pickup_appt_end IS 'Pickup appointment window end time';
COMMENT ON COLUMN loads.delivery_appt_start IS 'Delivery appointment window start time';
COMMENT ON COLUMN loads.delivery_appt_end IS 'Delivery appointment window end time';
COMMENT ON COLUMN loads.pieces_count IS 'Number of pieces/units';
COMMENT ON COLUMN loads.pallets_count IS 'Number of pallets';
COMMENT ON COLUMN loads.length_in IS 'Freight length in inches';
COMMENT ON COLUMN loads.width_in IS 'Freight width in inches';
COMMENT ON COLUMN loads.height_in IS 'Freight height in inches';
COMMENT ON COLUMN loads.stackable IS 'Whether freight can be stacked';
COMMENT ON COLUMN loads.special_instructions IS 'Special handling or routing instructions';
COMMENT ON COLUMN loads.loading_notes IS 'Pickup location notes (dock info, gate codes, etc.)';
COMMENT ON COLUMN loads.delivery_notes IS 'Delivery location notes (dock info, gate codes, etc.)';
