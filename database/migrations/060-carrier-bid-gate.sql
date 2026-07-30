-- Migration 060: Carrier Bid Gate
-- Blocks unverified carriers from placing bids at the RLS level.
-- Requires: verified status + FMCSA AUTHORIZED + valid insurance.

-- 1. Eligibility check function
CREATE OR REPLACE FUNCTION public.check_carrier_eligible(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_rec record;
BEGIN
  SELECT status, fmcsa_status, insurance_expires_at
    INTO v_rec
    FROM carrier_verifications
   WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  RETURN (
    v_rec.status = 'verified'
    AND v_rec.fmcsa_status = 'AUTHORIZED'
    AND v_rec.insurance_expires_at > CURRENT_DATE
  );
END;
$$;

-- 2. Replace the broad FOR ALL policy with granular CRUD policies.
-- The existing policy allowed any carrier to INSERT/SELECT/UPDATE/DELETE
-- their own bids without verification checks.

DROP POLICY IF EXISTS "carriers_manage_own_bids" ON bids;

-- SELECT: carriers can always view their own bids
CREATE POLICY "carriers_select_own_bids"
  ON bids FOR SELECT
  USING (carrier_id = auth.uid());

-- INSERT: carriers can only bid if they pass the eligibility check
CREATE POLICY "carriers_insert_bids_verified"
  ON bids FOR INSERT
  WITH CHECK (
    carrier_id = auth.uid()
    AND check_carrier_eligible(company_id)
  );

-- UPDATE: carriers can update their own bids (e.g., notes)
CREATE POLICY "carriers_update_own_bids"
  ON bids FOR UPDATE
  USING (carrier_id = auth.uid())
  WITH CHECK (carrier_id = auth.uid());

-- DELETE: carriers can withdraw their own bids
CREATE POLICY "carriers_delete_own_bids"
  ON bids FOR DELETE
  USING (carrier_id = auth.uid());
