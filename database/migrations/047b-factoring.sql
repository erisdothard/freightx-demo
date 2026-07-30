-- Phase 17: Factoring Requests
-- Carriers can request invoice factoring on delivered loads.

CREATE TABLE IF NOT EXISTS factoring_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES companies(id) ON DELETE SET NULL,
  load_id         UUID REFERENCES loads(id) ON DELETE SET NULL,
  load_number     TEXT,
  invoice_amount  NUMERIC(12, 2) NOT NULL,
  fee_percent     NUMERIC(5, 2) NOT NULL DEFAULT 3.00,
  net_payout      NUMERIC(12, 2) GENERATED ALWAYS AS (
                    invoice_amount - (invoice_amount * fee_percent / 100)
                  ) STORED,
  status          TEXT NOT NULL DEFAULT 'requested'
                    CHECK (status IN ('requested', 'approved', 'funded', 'denied', 'cancelled')),
  factor_partner  TEXT,
  notes           TEXT,
  requested_at    TIMESTAMPTZ DEFAULT NOW(),
  approved_at     TIMESTAMPTZ,
  funded_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS factoring_requests_carrier_idx ON factoring_requests (carrier_id);
CREATE INDEX IF NOT EXISTS factoring_requests_load_idx    ON factoring_requests (load_id);
CREATE INDEX IF NOT EXISTS factoring_requests_status_idx  ON factoring_requests (status);

ALTER TABLE factoring_requests ENABLE ROW LEVEL SECURITY;

-- Carriers can see their own factoring requests
CREATE POLICY "factoring_requests_carrier_select"
  ON factoring_requests FOR SELECT
  TO authenticated
  USING (carrier_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Carriers can create requests
CREATE POLICY "factoring_requests_carrier_insert"
  ON factoring_requests FOR INSERT
  TO authenticated
  WITH CHECK (carrier_id = auth.uid());

-- Carriers can cancel their own pending requests; admins can update any
CREATE POLICY "factoring_requests_update"
  ON factoring_requests FOR UPDATE
  TO authenticated
  USING (
    carrier_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_factoring_requests_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER factoring_requests_updated_at
  BEFORE UPDATE ON factoring_requests
  FOR EACH ROW EXECUTE FUNCTION update_factoring_requests_updated_at();
