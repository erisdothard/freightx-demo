-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 077: Hazmat BOL PHMSA Compliance Upgrade (P2-05)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- PHMSA (49 CFR § 172.200-204) requires hazmat shipping papers to include:
--   1. Proper shipping name (49 CFR § 172.101)
--   2. Hazard class/division (49 CFR § 172.101)
--   3. UN/NA identification number (49 CFR § 172.101)
--   4. Packing group (I, II, III) (49 CFR § 172.101)
--   5. Total quantity by weight/volume (49 CFR § 172.202)
--   6. Emergency response phone (49 CFR § 172.604)
--   7. Shipper certification statement (49 CFR § 172.204)
--
-- This migration:
--   - Adds hazmat-specific columns to loads
--   - Updates validate_bol_requirements() to enforce PHMSA fields
--   - Creates hazmat_validate_shipping_paper() dedicated check
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Hazmat shipping paper columns on loads ───────────────────────────────────
ALTER TABLE loads ADD COLUMN IF NOT EXISTS hazmat_proper_shipping_name text;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS hazmat_class text;        -- e.g., '3', '8', '2.1'
ALTER TABLE loads ADD COLUMN IF NOT EXISTS hazmat_un_number text;    -- e.g., 'UN1203', 'NA1993'
ALTER TABLE loads ADD COLUMN IF NOT EXISTS hazmat_packing_group text
  CHECK (hazmat_packing_group IS NULL OR hazmat_packing_group IN ('I', 'II', 'III'));
ALTER TABLE loads ADD COLUMN IF NOT EXISTS hazmat_quantity text;     -- e.g., '500 kg', '200 gal'
ALTER TABLE loads ADD COLUMN IF NOT EXISTS hazmat_emergency_phone text;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS hazmat_placard_required boolean DEFAULT false;
ALTER TABLE loads ADD COLUMN IF NOT EXISTS hazmat_reportable_quantity boolean DEFAULT false;

-- ── RPC: Validate hazmat shipping paper compliance ───────────────────────────
CREATE OR REPLACE FUNCTION public.validate_hazmat_shipping_paper(p_load_id uuid)
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

  IF v_load.hazmat IS NOT TRUE THEN
    RETURN jsonb_build_object('valid', true, 'errors', '{}'::text[], 'hazmat', false);
  END IF;

  -- 49 CFR § 172.202(a)(1) — Proper shipping name
  IF v_load.hazmat_proper_shipping_name IS NULL OR trim(v_load.hazmat_proper_shipping_name) = '' THEN
    v_errors := array_append(v_errors, 'Proper shipping name required (49 CFR § 172.202)');
  END IF;

  -- 49 CFR § 172.202(a)(2) — Hazard class
  IF v_load.hazmat_class IS NULL OR trim(v_load.hazmat_class) = '' THEN
    v_errors := array_append(v_errors, 'Hazard class/division required (49 CFR § 172.202)');
  END IF;

  -- 49 CFR § 172.202(a)(3) — UN/NA identification number
  IF v_load.hazmat_un_number IS NULL OR trim(v_load.hazmat_un_number) = '' THEN
    v_errors := array_append(v_errors, 'UN/NA identification number required (49 CFR § 172.202)');
  ELSIF v_load.hazmat_un_number !~ '^(UN|NA)[0-9]{4}$' THEN
    v_errors := array_append(v_errors, 'UN/NA number must be format UN#### or NA#### (e.g., UN1203)');
  END IF;

  -- 49 CFR § 172.202(a)(4) — Packing group
  IF v_load.hazmat_packing_group IS NULL THEN
    v_errors := array_append(v_errors, 'Packing group (I, II, or III) required (49 CFR § 172.202)');
  END IF;

  -- 49 CFR § 172.202(a)(5) — Total quantity
  IF v_load.hazmat_quantity IS NULL OR trim(v_load.hazmat_quantity) = '' THEN
    v_errors := array_append(v_errors, 'Total quantity (weight or volume) required (49 CFR § 172.202)');
  END IF;

  -- 49 CFR § 172.604 — Emergency response telephone number
  IF v_load.hazmat_emergency_phone IS NULL OR trim(v_load.hazmat_emergency_phone) = '' THEN
    v_errors := array_append(v_errors, '24-hour emergency response phone number required (49 CFR § 172.604)');
  END IF;

  -- 49 CFR § 172.204 — Shipper certification (via special_instructions)
  IF v_load.special_instructions IS NULL
     OR v_load.special_instructions !~* 'certif' THEN
    v_errors := array_append(v_errors,
      'Shipper certification statement required (49 CFR § 172.204). Include in special instructions.');
  END IF;

  RETURN jsonb_build_object(
    'valid', array_length(v_errors, 1) IS NULL,
    'errors', v_errors,
    'hazmat', true,
    'summary', jsonb_build_object(
      'proper_shipping_name', v_load.hazmat_proper_shipping_name,
      'class', v_load.hazmat_class,
      'un_number', v_load.hazmat_un_number,
      'packing_group', v_load.hazmat_packing_group,
      'quantity', v_load.hazmat_quantity,
      'emergency_phone', v_load.hazmat_emergency_phone,
      'placard_required', v_load.hazmat_placard_required,
      'reportable_quantity', v_load.hazmat_reportable_quantity
    )
  );
END;
$$;

-- ── Update BOL validation to include PHMSA checks for hazmat loads ───────────
CREATE OR REPLACE FUNCTION public.validate_bol_requirements(p_load_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_load         record;
  v_errors       text[] := '{}';
  v_hazmat_result jsonb;
BEGIN
  SELECT * INTO v_load FROM public.loads WHERE id = p_load_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'errors', ARRAY['Load not found']);
  END IF;

  -- Standard BOL fields (49 CFR § 373.101)
  IF v_load.shipper_name IS NULL OR trim(v_load.shipper_name) = '' THEN
    v_errors := array_append(v_errors, 'Shipper name is required (49 CFR § 373.101)');
  END IF;

  IF v_load.receiver_name IS NULL OR trim(v_load.receiver_name) = '' THEN
    v_errors := array_append(v_errors, 'Receiver/consignee name is required (49 CFR § 373.101)');
  END IF;

  IF v_load.commodity IS NULL OR trim(v_load.commodity) = '' THEN
    v_errors := array_append(v_errors, 'Commodity description is required (49 CFR § 373.101)');
  END IF;

  IF v_load.weight_lbs IS NULL OR v_load.weight_lbs <= 0 THEN
    v_errors := array_append(v_errors, 'Weight is required (49 CFR § 373.101)');
  END IF;

  IF v_load.origin_city IS NULL OR trim(v_load.origin_city) = '' THEN
    v_errors := array_append(v_errors, 'Origin city is required');
  END IF;
  IF v_load.origin_state IS NULL OR trim(v_load.origin_state) = '' THEN
    v_errors := array_append(v_errors, 'Origin state is required');
  END IF;

  IF v_load.dest_city IS NULL OR trim(v_load.dest_city) = '' THEN
    v_errors := array_append(v_errors, 'Destination city is required');
  END IF;
  IF v_load.dest_state IS NULL OR trim(v_load.dest_state) = '' THEN
    v_errors := array_append(v_errors, 'Destination state is required');
  END IF;

  -- Hazmat-specific PHMSA validation (49 CFR § 172.200-204)
  IF v_load.hazmat = true THEN
    v_hazmat_result := public.validate_hazmat_shipping_paper(p_load_id);
    IF NOT (v_hazmat_result->>'valid')::boolean THEN
      -- Merge hazmat errors into the main error list
      SELECT array_agg(elem) INTO v_errors
      FROM (
        SELECT unnest(v_errors) AS elem
        UNION ALL
        SELECT jsonb_array_elements_text(v_hazmat_result->'errors')
      ) combined;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'valid', array_length(v_errors, 1) IS NULL,
    'errors', v_errors,
    'hazmat', COALESCE(v_load.hazmat, false)
  );
END;
$$;

COMMIT;
