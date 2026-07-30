-- Phase 17: Insurance Expiry Monitoring & Carrier Risk Score
-- Adds insurance expiry tracking and risk score to carrier_verifications.
-- Adds a verification_schedule table for periodic FMCSA re-vetting.

-- Add monitoring columns to carrier_verifications
ALTER TABLE carrier_verifications
  ADD COLUMN IF NOT EXISTS insurance_expiry_date  DATE,
  ADD COLUMN IF NOT EXISTS last_verified_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_verify_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS risk_score              SMALLINT CHECK (risk_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS risk_factors            JSONB DEFAULT '{}';

-- Update status enum to include insurance_warning (if stored as text)
-- carrier_verifications.status is already TEXT so no migration needed.
-- The carrier-health-check edge function will set status = 'insurance_warning'.

-- Verification schedule — tracks when each carrier is due for FMCSA re-check
CREATE TABLE IF NOT EXISTS verification_schedule (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id      UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  carrier_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_at    TIMESTAMPTZ NOT NULL,
  completed_at    TIMESTAMPTZ,
  trigger_reason  TEXT,            -- 'periodic', 'insurance_expiry', 'manual'
  result          JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, scheduled_at)
);

CREATE INDEX IF NOT EXISTS verification_schedule_company_idx    ON verification_schedule (company_id);
CREATE INDEX IF NOT EXISTS verification_schedule_scheduled_idx  ON verification_schedule (scheduled_at);

ALTER TABLE verification_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "verification_schedule_admin_all"
  ON verification_schedule FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "verification_schedule_carrier_select"
  ON verification_schedule FOR SELECT
  TO authenticated
  USING (carrier_id = auth.uid());
