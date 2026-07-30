-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 066: Regulatory Compliance (P0-07/08/09/10)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- P0-07: Broker authority disclosure (track MC + bond status on companies)
-- P0-08: Hazmat carrier certification gate (block uncertified carriers)
-- P0-09: Insurance minimum by load type (49 CFR § 387.9)
-- P0-10: Record retention / soft-delete on regulated tables (3-year floor)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- P0-07: BROKER AUTHORITY DISCLOSURE
-- Brokers must hold MC authority + $75K surety bond (49 U.S.C. § 13102(2))
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS broker_bond_amount     numeric(10,2),
  ADD COLUMN IF NOT EXISTS broker_bond_verified   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS broker_bond_expires_at date;

-- Loads posted by unverified brokers display a disclosure badge in the UI.
-- The DB tracks the status; frontend reads it from the company join.

-- ═══════════════════════════════════════════════════════════════════════════
-- P0-08: HAZMAT CARRIER CERTIFICATION GATE
-- 49 CFR § 385.403 — carriers must hold hazmat safety permit
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE carrier_verifications
  ADD COLUMN IF NOT EXISTS hazmat_certified       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hazmat_permit_number   text,
  ADD COLUMN IF NOT EXISTS hazmat_permit_expires  date;

-- Function: check if a carrier is hazmat-eligible
CREATE OR REPLACE FUNCTION public.check_hazmat_eligible(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rec record;
BEGIN
  SELECT hazmat_certified, hazmat_permit_expires
    INTO v_rec
    FROM public.carrier_verifications
   WHERE company_id = p_company_id;

  IF NOT FOUND THEN RETURN false; END IF;

  RETURN (
    v_rec.hazmat_certified = true
    AND (v_rec.hazmat_permit_expires IS NULL OR v_rec.hazmat_permit_expires > CURRENT_DATE)
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- P0-09: INSURANCE MINIMUM BY LOAD TYPE
-- 49 CFR § 387.9 — federal minimum insurance requirements
--   General freight: $750,000
--   Hazmat (general): $1,000,000
--   Hazmat (explosives/poison gas/radioactive): $5,000,000
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_insurance_minimum(
  p_hazmat boolean DEFAULT false
)
RETURNS integer
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF p_hazmat THEN
    RETURN 1000000;  -- $1M for hazmat
  ELSE
    RETURN 750000;   -- $750K general freight
  END IF;
END;
$$;

-- Function: validate carrier insurance covers the load type
CREATE OR REPLACE FUNCTION public.check_insurance_adequate(
  p_company_id uuid,
  p_hazmat     boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_amount   integer;
  v_minimum  integer;
BEGIN
  SELECT insurance_amount_usd INTO v_amount
    FROM public.carrier_verifications
   WHERE company_id = p_company_id;

  IF NOT FOUND OR v_amount IS NULL THEN
    RETURN false;
  END IF;

  v_minimum := public.get_insurance_minimum(p_hazmat);
  RETURN v_amount >= v_minimum;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- UPDATE accept_bid() — Add hazmat + insurance checks
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.accept_bid(bid_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_bid  record;
  v_load record;
  v_hash TEXT;
BEGIN
  -- Lock the bid row
  SELECT * INTO v_bid FROM bids WHERE id = bid_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bid not found'; END IF;

  IF v_bid.status != 'pending' THEN
    RAISE EXCEPTION 'Bid is no longer pending (current status: %)', v_bid.status;
  END IF;

  -- Lock the load row to prevent concurrent accept_bid / book_now races
  SELECT * INTO v_load FROM loads WHERE id = v_bid.load_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Load not found'; END IF;

  IF v_load.posted_by != auth.uid() THEN
    RAISE EXCEPTION 'Not authorized — you did not post this load';
  END IF;

  -- Guard: load must still be in a biddable state
  IF v_load.status NOT IN ('posted', 'bid_received') THEN
    RAISE EXCEPTION 'Load is no longer available (current status: %)', v_load.status;
  END IF;

  -- P0-08: Hazmat certification check
  IF v_load.hazmat = true AND v_bid.company_id IS NOT NULL THEN
    IF NOT check_hazmat_eligible(v_bid.company_id) THEN
      RAISE EXCEPTION 'Carrier is not certified for hazmat loads (49 CFR § 385.403)';
    END IF;
  END IF;

  -- P0-09: Insurance minimum check
  IF v_bid.company_id IS NOT NULL THEN
    IF NOT check_insurance_adequate(v_bid.company_id, v_load.hazmat) THEN
      RAISE EXCEPTION 'Carrier insurance does not meet minimum requirements for this load type (49 CFR § 387.9)';
    END IF;
  END IF;

  -- Accept this bid
  UPDATE bids SET status = 'accepted', updated_at = now() WHERE id = bid_id;

  -- Decline all other pending bids on this load
  UPDATE bids SET status = 'declined', updated_at = now()
    WHERE load_id = v_bid.load_id
      AND id != bid_id
      AND status = 'pending';

  -- Award the load
  UPDATE loads
    SET status    = 'awarded',
        bid_count = (SELECT count(*) FROM bids WHERE load_id = v_bid.load_id)
    WHERE id = v_bid.load_id;

  -- Attestation: Snapshot carrier identity at bid acceptance
  IF v_bid.company_id IS NOT NULL THEN
    v_hash := create_carrier_attestation(
      bid_id, v_bid.load_id, v_bid.company_id, v_bid.carrier_id
    );
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- UPDATE book_now() — Add hazmat + insurance checks
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.book_now(p_load_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_load      record;
  v_company   record;
  v_bid_id    UUID;
  v_hash      TEXT;
BEGIN
  -- Lock the load row
  SELECT * INTO v_load FROM loads WHERE id = p_load_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Load not found'; END IF;

  IF v_load.status != 'posted' THEN
    RAISE EXCEPTION 'Load is no longer available (current status: %)', v_load.status;
  END IF;

  SELECT * INTO v_company FROM companies WHERE owner_id = auth.uid() LIMIT 1;

  -- P0-08: Hazmat certification check
  IF v_load.hazmat = true AND v_company.id IS NOT NULL THEN
    IF NOT check_hazmat_eligible(v_company.id) THEN
      RAISE EXCEPTION 'Your company is not certified for hazmat loads (49 CFR § 385.403)';
    END IF;
  END IF;

  -- P0-09: Insurance minimum check
  IF v_company.id IS NOT NULL THEN
    IF NOT check_insurance_adequate(v_company.id, v_load.hazmat) THEN
      RAISE EXCEPTION 'Your insurance does not meet minimum requirements for this load type (49 CFR § 387.9)';
    END IF;
  END IF;

  INSERT INTO bids (load_id, carrier_id, company_id, company_name, amount_usd, status)
  VALUES (
    p_load_id,
    auth.uid(),
    v_company.id,
    coalesce(v_company.name, 'Independent Carrier'),
    v_load.rate_usd,
    'accepted'
  )
  RETURNING id INTO v_bid_id;

  UPDATE bids
    SET status = 'declined', updated_at = now()
    WHERE load_id = p_load_id
      AND carrier_id != auth.uid()
      AND status = 'pending';

  UPDATE loads
    SET status    = 'awarded',
        bid_count = bid_count + 1
    WHERE id = p_load_id;

  -- Attestation: Snapshot carrier identity at instant booking
  IF v_company.id IS NOT NULL THEN
    v_hash := create_carrier_attestation(
      v_bid_id, p_load_id, v_company.id, auth.uid()
    );
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- P0-10: RECORD RETENTION — Soft-delete on regulated tables
-- 49 CFR § 371.3 — 3-year retention floor for broker records
-- ═══════════════════════════════════════════════════════════════════════════

-- Add deleted_at column to regulated tables
ALTER TABLE loads     ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE bids      ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Partial indexes for fast filtering of active (non-deleted) records
CREATE INDEX IF NOT EXISTS idx_loads_active     ON loads(id)     WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bids_active      ON bids(id)      WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_active ON documents(id) WHERE deleted_at IS NULL;

-- Soft-delete function — sets deleted_at instead of physical delete
CREATE OR REPLACE FUNCTION public.soft_delete_load(p_load_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Only the load poster or admin can soft-delete
  IF NOT EXISTS (
    SELECT 1 FROM public.loads
    WHERE id = p_load_id
      AND (posted_by = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  ) THEN
    RAISE EXCEPTION 'Not authorized to delete this load';
  END IF;

  UPDATE public.loads SET deleted_at = now() WHERE id = p_load_id AND deleted_at IS NULL;
END;
$$;

-- Prevent physical deletion of regulated records within 3-year retention window
CREATE OR REPLACE FUNCTION public.prevent_premature_deletion()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.created_at > (now() - interval '3 years') THEN
    RAISE EXCEPTION 'Cannot physically delete records less than 3 years old (49 CFR § 371.3). Use soft-delete instead.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS loads_retention_guard ON loads;
CREATE TRIGGER loads_retention_guard
  BEFORE DELETE ON loads
  FOR EACH ROW EXECUTE FUNCTION prevent_premature_deletion();

DROP TRIGGER IF EXISTS bids_retention_guard ON bids;
CREATE TRIGGER bids_retention_guard
  BEFORE DELETE ON bids
  FOR EACH ROW EXECUTE FUNCTION prevent_premature_deletion();

DROP TRIGGER IF EXISTS documents_retention_guard ON documents;
CREATE TRIGGER documents_retention_guard
  BEFORE DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION prevent_premature_deletion();

-- Update loads SELECT policy to exclude soft-deleted records for non-admins
DROP POLICY IF EXISTS "loads_select_all" ON loads;
CREATE POLICY "loads_select_active" ON loads
  FOR SELECT USING (
    deleted_at IS NULL
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

COMMIT;
