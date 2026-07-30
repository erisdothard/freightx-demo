-- Migration 064: Cryptographic Chain of Custody — Carrier Attestation
--
-- Creates a tamper-evident identity chain from verification → bid acceptance →
-- document signing → delivery webhook. This is the "FinTech bridge" that lets
-- banks and factoring companies cryptographically prove the delivering carrier
-- is the same verified entity that was authorized to haul the load.
--
-- The attestation_hash is a SHA-256 of the carrier's identity snapshot at the
-- exact millisecond the bid is accepted. That hash flows into every signed
-- document and the final delivery webhook payload, creating a legal instrument.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── 1. CARRIER ATTESTATIONS TABLE ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.carrier_attestations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  bid_id              UUID NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
  load_id             UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  carrier_id          UUID NOT NULL,

  -- FMCSA snapshot at bid acceptance (millisecond-precision)
  mc_number           TEXT,
  dot_number          TEXT,
  fmcsa_status        TEXT,                -- 'AUTHORIZED' at acceptance time
  safety_rating       TEXT,                -- 'Satisfactory', 'Conditional', etc.
  insurance_carrier   TEXT,
  insurance_policy    TEXT,
  insurance_expires_at DATE,
  verification_status TEXT,                -- 'verified' at acceptance time

  -- Temporal anchor
  attested_at         TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),  -- clock_timestamp() for sub-ms precision

  -- Cryptographic hash — SHA-256 of canonical identity fields
  -- This hash is embedded into every subsequent document signature
  -- and the delivery webhook payload, creating the chain of custody.
  attestation_hash    TEXT NOT NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS carrier_attestations_bid_idx
  ON public.carrier_attestations(bid_id);

CREATE INDEX IF NOT EXISTS carrier_attestations_load_idx
  ON public.carrier_attestations(load_id);

CREATE INDEX IF NOT EXISTS carrier_attestations_company_idx
  ON public.carrier_attestations(company_id);

-- RLS
ALTER TABLE public.carrier_attestations ENABLE ROW LEVEL SECURITY;

-- Attestations are immutable audit records — read-only for users
CREATE POLICY "attestation_select_own"
  ON public.carrier_attestations FOR SELECT
  USING (
    carrier_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM loads WHERE id = load_id AND posted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only the system (SECURITY DEFINER functions) can insert
CREATE POLICY "attestation_service_insert"
  ON public.carrier_attestations FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ── 2. ATTESTATION CREATION FUNCTION ───────────────────────────────────────────
-- Called from accept_bid() and book_now() to snapshot the carrier's verified
-- identity and compute the SHA-256 attestation hash.

CREATE OR REPLACE FUNCTION public.create_carrier_attestation(
  p_bid_id     UUID,
  p_load_id    UUID,
  p_company_id UUID,
  p_carrier_id UUID
)
RETURNS TEXT  -- returns the attestation_hash
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cv            record;
  v_attested_at   TIMESTAMPTZ;
  v_canonical     TEXT;
  v_hash          TEXT;
BEGIN
  -- Snapshot the carrier verification at this exact moment
  SELECT mc_number, dot_number, fmcsa_status, safety_rating,
         insurance_carrier, insurance_policy, insurance_expires_at,
         status
    INTO v_cv
    FROM carrier_verifications
   WHERE company_id = p_company_id;

  -- Use clock_timestamp() for sub-millisecond precision
  v_attested_at := clock_timestamp();

  -- Build canonical string for hashing (deterministic field order)
  -- Format: pipe-delimited, NULL → empty string
  v_canonical := COALESCE(p_bid_id::TEXT, '')      || '|' ||
                 COALESCE(p_load_id::TEXT, '')      || '|' ||
                 COALESCE(p_company_id::TEXT, '')    || '|' ||
                 COALESCE(p_carrier_id::TEXT, '')    || '|' ||
                 COALESCE(v_cv.mc_number, '')        || '|' ||
                 COALESCE(v_cv.dot_number, '')       || '|' ||
                 COALESCE(v_cv.fmcsa_status, '')     || '|' ||
                 COALESCE(v_cv.safety_rating, '')    || '|' ||
                 COALESCE(v_cv.insurance_carrier, '') || '|' ||
                 COALESCE(v_cv.insurance_policy, '')  || '|' ||
                 COALESCE(v_cv.insurance_expires_at::TEXT, '') || '|' ||
                 COALESCE(v_cv.status::TEXT, '')      || '|' ||
                 v_attested_at::TEXT;

  -- SHA-256 hash
  v_hash := encode(digest(v_canonical, 'sha256'), 'hex');

  -- Insert immutable attestation record
  INSERT INTO carrier_attestations (
    bid_id, load_id, company_id, carrier_id,
    mc_number, dot_number, fmcsa_status, safety_rating,
    insurance_carrier, insurance_policy, insurance_expires_at,
    verification_status, attested_at, attestation_hash
  ) VALUES (
    p_bid_id, p_load_id, p_company_id, p_carrier_id,
    v_cv.mc_number, v_cv.dot_number, v_cv.fmcsa_status, v_cv.safety_rating,
    v_cv.insurance_carrier, v_cv.insurance_policy, v_cv.insurance_expires_at,
    v_cv.status::TEXT, v_attested_at, v_hash
  );

  RETURN v_hash;
END;
$$;


-- ── 3. ADD attestation_hash COLUMN TO DOCUMENTS ────────────────────────────────
-- When a BOL or Rate Con is signed, the signing logic embeds the attestation hash
-- linking the signed document to the verified carrier identity.

ALTER TABLE documents ADD COLUMN IF NOT EXISTS attestation_hash TEXT;


-- ── 4. UPDATE accept_bid() TO CREATE ATTESTATION ───────────────────────────────
-- Preserves all existing logic (race guard, FOR UPDATE locks) and adds
-- attestation snapshot after the bid is accepted.

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

  -- ▸ ATTESTATION: Snapshot carrier identity at bid acceptance
  IF v_bid.company_id IS NOT NULL THEN
    v_hash := create_carrier_attestation(
      bid_id, v_bid.load_id, v_bid.company_id, v_bid.carrier_id
    );
  END IF;
END;
$$;


-- ── 5. UPDATE book_now() TO CREATE ATTESTATION ─────────────────────────────────

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

  -- ▸ ATTESTATION: Snapshot carrier identity at instant booking
  IF v_company.id IS NOT NULL THEN
    v_hash := create_carrier_attestation(
      v_bid_id, p_load_id, v_company.id, auth.uid()
    );
  END IF;
END;
$$;


-- ── 6. UPDATE build_delivery_payload() — CERTIFICATE OF DELIVERY ───────────────
-- Now includes the attestation chain: verified identity hash + document hashes.
-- This makes the payload a cryptographic proof, not a "trust me" note.

CREATE OR REPLACE FUNCTION public.build_delivery_payload(p_load_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_payload      jsonb;
  v_load         record;
  v_bid          record;
  v_company      record;
  v_bol          record;
  v_rate_con     record;
  v_attestation  record;
BEGIN
  -- Load details
  SELECT id, load_number, origin_city, origin_state, origin_address, origin_zip,
         dest_city, dest_state, dest_address, dest_zip,
         rate_usd, equipment, pickup_date, delivery_date,
         total_miles, weight_lbs, commodity, posted_by, status
    INTO v_load
    FROM loads
   WHERE id = p_load_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'load_not_found');
  END IF;

  -- Accepted bid + carrier info
  SELECT b.id AS bid_id, b.amount_usd, b.carrier_id, b.company_id, b.company_name
    INTO v_bid
    FROM bids b
   WHERE b.load_id = p_load_id
     AND b.status = 'accepted'
   LIMIT 1;

  -- Carrier company details (MC#, DOT#)
  IF v_bid.company_id IS NOT NULL THEN
    SELECT c.name, cv.mc_number, cv.dot_number
      INTO v_company
      FROM companies c
      LEFT JOIN carrier_verifications cv ON cv.company_id = c.id
     WHERE c.id = v_bid.company_id;
  END IF;

  -- Signed BOL
  SELECT d.file_url, d.signed_at, d.signatory_name, d.doc_hash,
         d.signed_doc_hash, d.attestation_hash AS doc_attestation_hash
    INTO v_bol
    FROM documents d
   WHERE d.load_id = p_load_id
     AND d.type = 'bill_of_lading'
     AND d.signed_at IS NOT NULL
   ORDER BY d.signed_at DESC
   LIMIT 1;

  -- Signed Rate Confirmation
  SELECT d.file_url, d.signed_at, d.doc_hash,
         d.signed_doc_hash, d.attestation_hash AS doc_attestation_hash
    INTO v_rate_con
    FROM documents d
   WHERE d.load_id = p_load_id
     AND d.type = 'rate_confirmation'
     AND d.signed_at IS NOT NULL
   ORDER BY d.signed_at DESC
   LIMIT 1;

  -- Carrier attestation (chain of custody anchor)
  IF v_bid.bid_id IS NOT NULL THEN
    SELECT ca.attestation_hash, ca.attested_at,
           ca.mc_number, ca.dot_number, ca.fmcsa_status,
           ca.safety_rating, ca.insurance_expires_at,
           ca.verification_status
      INTO v_attestation
      FROM carrier_attestations ca
     WHERE ca.bid_id = v_bid.bid_id;
  END IF;

  -- Assemble Certificate of Delivery payload
  v_payload := jsonb_build_object(
    'event', 'load.delivered',
    'timestamp', NOW()::TEXT,
    'load', jsonb_build_object(
      'id',            v_load.id,
      'load_number',   v_load.load_number,
      'origin',        jsonb_build_object(
        'city', v_load.origin_city, 'state', v_load.origin_state,
        'address', v_load.origin_address, 'zip', v_load.origin_zip
      ),
      'destination',   jsonb_build_object(
        'city', v_load.dest_city, 'state', v_load.dest_state,
        'address', v_load.dest_address, 'zip', v_load.dest_zip
      ),
      'rate_usd',      v_load.rate_usd,
      'equipment',     v_load.equipment,
      'pickup_date',   v_load.pickup_date,
      'delivery_date', v_load.delivery_date,
      'total_miles',   v_load.total_miles,
      'weight_lbs',    v_load.weight_lbs,
      'commodity',     v_load.commodity
    ),
    'carrier', CASE WHEN v_bid IS NOT NULL THEN jsonb_build_object(
      'company_name', COALESCE(v_company.name, v_bid.company_name),
      'mc_number',    v_company.mc_number,
      'dot_number',   v_company.dot_number,
      'bid_amount',   v_bid.amount_usd,
      'carrier_id',   v_bid.carrier_id
    ) ELSE NULL END,

    -- ▸ CHAIN OF CUSTODY — the cryptographic proof chain
    'chain_of_custody', CASE WHEN v_attestation.attestation_hash IS NOT NULL THEN jsonb_build_object(
      'attestation_hash',       v_attestation.attestation_hash,
      'attested_at',            v_attestation.attested_at,
      'verified_identity', jsonb_build_object(
        'mc_number',            v_attestation.mc_number,
        'dot_number',           v_attestation.dot_number,
        'fmcsa_status',         v_attestation.fmcsa_status,
        'safety_rating',        v_attestation.safety_rating,
        'insurance_expires_at', v_attestation.insurance_expires_at,
        'verification_status',  v_attestation.verification_status
      ),
      'bol_hash',               v_bol.doc_hash,
      'bol_signed_hash',        v_bol.signed_doc_hash,
      'bol_attestation_link',   v_bol.doc_attestation_hash,
      'rate_con_hash',          v_rate_con.doc_hash,
      'rate_con_signed_hash',   v_rate_con.signed_doc_hash,
      'rate_con_attestation_link', v_rate_con.doc_attestation_hash,
      'chain_valid', (
        -- Chain is valid if the attestation hash embedded in the documents
        -- matches the attestation hash from bid acceptance
        COALESCE(v_bol.doc_attestation_hash = v_attestation.attestation_hash, false)
        AND COALESCE(v_rate_con.doc_attestation_hash = v_attestation.attestation_hash, false)
      )
    ) ELSE NULL END,

    'bol', CASE WHEN v_bol.file_url IS NOT NULL THEN jsonb_build_object(
      'file_url',       v_bol.file_url,
      'signed_at',      v_bol.signed_at,
      'signatory_name', v_bol.signatory_name,
      'doc_hash',       v_bol.doc_hash,
      'signed_doc_hash', v_bol.signed_doc_hash
    ) ELSE NULL END,
    'rate_confirmation', CASE WHEN v_rate_con.file_url IS NOT NULL THEN jsonb_build_object(
      'file_url',        v_rate_con.file_url,
      'signed_at',       v_rate_con.signed_at,
      'doc_hash',        v_rate_con.doc_hash,
      'signed_doc_hash', v_rate_con.signed_doc_hash
    ) ELSE NULL END
  );

  RETURN v_payload;
END;
$$;
