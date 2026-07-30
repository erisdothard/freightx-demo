-- 044: Receipt scanning and expense tracking for drivers

CREATE TABLE IF NOT EXISTS receipts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id           uuid NOT NULL REFERENCES profiles(id),
  load_number         text,
  category            text NOT NULL CHECK (category IN (
    'fuel', 'maintenance', 'tolls', 'meals', 'lodging', 'parking', 'supplies', 'other'
  )),
  amount_usd          numeric(10,2) NOT NULL,
  vendor_name         text NOT NULL DEFAULT '',
  receipt_date        date NOT NULL DEFAULT CURRENT_DATE,
  notes               text,
  image_url           text NOT NULL,
  image_thumbnail_url text,
  file_size_bytes     integer,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_receipts_driver ON receipts(driver_id);
CREATE INDEX idx_receipts_load ON receipts(load_number);
CREATE INDEX idx_receipts_date ON receipts(receipt_date);
CREATE INDEX idx_receipts_category ON receipts(category);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

-- Drivers can manage their own receipts
CREATE POLICY "Drivers can read own receipts"
  ON receipts FOR SELECT TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "Drivers can insert own receipts"
  ON receipts FOR INSERT TO authenticated
  WITH CHECK (driver_id = auth.uid());

CREATE POLICY "Drivers can update own receipts"
  ON receipts FOR UPDATE TO authenticated
  USING (driver_id = auth.uid());

CREATE POLICY "Drivers can delete own receipts"
  ON receipts FOR DELETE TO authenticated
  USING (driver_id = auth.uid());

-- Carrier/admin can read
CREATE POLICY "Carriers can read receipts"
  ON receipts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin', 'dispatcher', 'accounting')
    )
  );

-- Storage bucket for receipt images
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload receipts"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'receipts');

CREATE POLICY "Public can read receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'receipts');
