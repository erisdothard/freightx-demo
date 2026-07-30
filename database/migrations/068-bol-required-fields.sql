-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 068: BOL Required Fields Validation (P1-04)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- 49 CFR § 373.101 requires BOL to contain:
--   1. Shipper name and address
--   2. Consignee (receiver) name and address
--   3. Description of commodities
--   4. Weight
--   5. Number of pieces/packages
--   6. Origin and destination
--
-- This migration adds server-side validation before BOL signing to ensure
-- the load record has all federally required fields populated.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Validation function: checks load has all required BOL fields before signing
CREATE OR REPLACE FUNCTION public.validate_bol_requirements(p_load_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_load    record;
  v_errors  text[] := '{}';
BEGIN
  SELECT * INTO v_load FROM public.loads WHERE id = p_load_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'errors', ARRAY['Load not found']);
  END IF;

  -- 1. Shipper info (origin party)
  IF v_load.shipper_name IS NULL OR trim(v_load.shipper_name) = '' THEN
    v_errors := array_append(v_errors, 'Shipper name is required (49 CFR § 373.101)');
  END IF;

  -- 2. Receiver info (consignee)
  IF v_load.receiver_name IS NULL OR trim(v_load.receiver_name) = '' THEN
    v_errors := array_append(v_errors, 'Receiver/consignee name is required (49 CFR § 373.101)');
  END IF;

  -- 3. Commodity description
  IF v_load.commodity IS NULL OR trim(v_load.commodity) = '' THEN
    v_errors := array_append(v_errors, 'Commodity description is required (49 CFR § 373.101)');
  END IF;

  -- 4. Weight
  IF v_load.weight_lbs IS NULL OR v_load.weight_lbs <= 0 THEN
    v_errors := array_append(v_errors, 'Weight is required (49 CFR § 373.101)');
  END IF;

  -- 5. Origin city/state
  IF v_load.origin_city IS NULL OR trim(v_load.origin_city) = '' THEN
    v_errors := array_append(v_errors, 'Origin city is required');
  END IF;
  IF v_load.origin_state IS NULL OR trim(v_load.origin_state) = '' THEN
    v_errors := array_append(v_errors, 'Origin state is required');
  END IF;

  -- 6. Destination city/state
  IF v_load.dest_city IS NULL OR trim(v_load.dest_city) = '' THEN
    v_errors := array_append(v_errors, 'Destination city is required');
  END IF;
  IF v_load.dest_state IS NULL OR trim(v_load.dest_state) = '' THEN
    v_errors := array_append(v_errors, 'Destination state is required');
  END IF;

  -- 7. Hazmat-specific: BOL must identify hazardous materials (49 CFR § 172.204)
  IF v_load.hazmat = true THEN
    IF v_load.special_instructions IS NULL OR trim(v_load.special_instructions) = '' THEN
      v_errors := array_append(v_errors, 'Hazmat loads require special handling instructions (49 CFR § 172.204)');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valid', array_length(v_errors, 1) IS NULL,
    'errors', v_errors
  );
END;
$$;

-- Trigger: block BOL document signing if required fields are missing
-- Fires before UPDATE on documents when signature columns are being set
CREATE OR REPLACE FUNCTION public.enforce_bol_requirements()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Only check BOL documents being signed (signature_url going from NULL to value)
  IF NEW.type != 'bol' THEN
    RETURN NEW;
  END IF;

  IF OLD.signature_url IS NULL AND NEW.signature_url IS NOT NULL THEN
    IF NEW.load_id IS NOT NULL THEN
      v_result := public.validate_bol_requirements(NEW.load_id);

      IF NOT (v_result->>'valid')::boolean THEN
        RAISE EXCEPTION 'BOL signing blocked — missing required fields: %',
          v_result->>'errors';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_bol_requirements_trigger ON documents;
CREATE TRIGGER enforce_bol_requirements_trigger
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION enforce_bol_requirements();

COMMIT;
