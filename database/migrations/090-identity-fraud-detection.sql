-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 090: Biometric ID + VoIP Detection (P4-04)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Advanced fraud layer. VoIP numbers are the #1 signal for double-brokering
-- and ghost carrier scams. Biometric liveness checks prevent identity theft.
--
-- Tables:
--   identity_verifications — liveness check + document scan records
--   phone_verifications — phone number risk assessment
--
-- RPCs:
--   submit_identity_verification() — record a liveness/ID check result
--   submit_phone_verification() — record phone risk assessment
--   get_identity_risk_profile() — aggregated fraud signals for a user
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Phone verification columns on profiles ──────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at    timestamptz,
  ADD COLUMN IF NOT EXISTS phone_carrier_type   text
    CHECK (phone_carrier_type IN ('mobile', 'landline', 'voip', 'unknown'));

-- ── Identity verifications ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS identity_verifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  company_id      uuid REFERENCES companies(id) ON DELETE CASCADE,

  -- Verification type
  check_type      text NOT NULL
                    CHECK (check_type IN ('liveness', 'document_scan', 'selfie_match',
                                          'address_verification', 'watchlist_screen')),

  -- Result
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'passed', 'failed', 'expired', 'manual_review')),
  confidence      numeric(5,2),                 -- 0-100% confidence score
  provider        text,                         -- e.g., 'onfido', 'jumio', 'persona'
  provider_ref    text,                         -- External reference ID
  failure_reason  text,
  metadata        jsonb DEFAULT '{}'::jsonb,    -- Provider-specific response data

  expires_at      timestamptz,                  -- Verification validity period
  verified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_verif_user ON identity_verifications(user_id, check_type);
CREATE INDEX IF NOT EXISTS idx_identity_verif_status ON identity_verifications(status)
  WHERE status IN ('pending', 'failed');

ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own verifications
CREATE POLICY "user_view_own_verifications" ON identity_verifications
  FOR SELECT USING (user_id = auth.uid());

-- Admins can view all
CREATE POLICY "admin_view_verifications" ON identity_verifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- System inserts via RPC
CREATE POLICY "system_insert_verifications" ON identity_verifications
  FOR INSERT WITH CHECK (true);

-- ── Phone verifications ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phone_verifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  phone_number    text NOT NULL,
  country_code    text DEFAULT 'US',

  carrier_name    text,
  carrier_type    text CHECK (carrier_type IN ('mobile', 'landline', 'voip', 'unknown')),
  is_voip         boolean,
  is_prepaid      boolean,
  is_ported       boolean,                     -- Number has been ported (fraud signal)

  risk_score      integer CHECK (risk_score BETWEEN 0 AND 100),
  risk_flags      jsonb DEFAULT '[]'::jsonb,   -- Array of flag strings
  provider        text,                         -- e.g., 'twilio_lookup', 'numverify'

  verified_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_phone_verif_user ON phone_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_verif_voip ON phone_verifications(is_voip) WHERE is_voip = true;

ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_view_own_phone" ON phone_verifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admin_view_phone" ON phone_verifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "system_insert_phone" ON phone_verifications
  FOR INSERT WITH CHECK (true);

-- ── RPC: Submit identity verification ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_identity_verification(
  p_user_id        uuid,
  p_check_type     text,
  p_status         text,
  p_confidence     numeric DEFAULT NULL,
  p_provider       text DEFAULT NULL,
  p_provider_ref   text DEFAULT NULL,
  p_failure_reason text DEFAULT NULL,
  p_metadata       jsonb DEFAULT '{}'::jsonb,
  p_expires_in_days integer DEFAULT 365
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.identity_verifications (
    user_id, company_id, check_type, status, confidence,
    provider, provider_ref, failure_reason, metadata,
    expires_at, verified_at
  )
  SELECT
    p_user_id,
    cm.company_id,
    p_check_type, p_status, p_confidence,
    p_provider, p_provider_ref, p_failure_reason, p_metadata,
    CASE WHEN p_status = 'passed' THEN now() + (p_expires_in_days || ' days')::interval ELSE NULL END,
    CASE WHEN p_status = 'passed' THEN now() ELSE NULL END
  FROM public.company_members cm
  WHERE cm.user_id = p_user_id
  LIMIT 1
  RETURNING id INTO v_id;

  -- If no company membership, insert without company_id
  IF v_id IS NULL THEN
    INSERT INTO public.identity_verifications (
      user_id, check_type, status, confidence,
      provider, provider_ref, failure_reason, metadata,
      expires_at, verified_at
    ) VALUES (
      p_user_id, p_check_type, p_status, p_confidence,
      p_provider, p_provider_ref, p_failure_reason, p_metadata,
      CASE WHEN p_status = 'passed' THEN now() + (p_expires_in_days || ' days')::interval ELSE NULL END,
      CASE WHEN p_status = 'passed' THEN now() ELSE NULL END
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- ── RPC: Submit phone verification ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_phone_verification(
  p_user_id      uuid,
  p_phone_number text,
  p_carrier_name text DEFAULT NULL,
  p_carrier_type text DEFAULT 'unknown',
  p_is_voip      boolean DEFAULT NULL,
  p_is_prepaid   boolean DEFAULT NULL,
  p_is_ported    boolean DEFAULT NULL,
  p_risk_score   integer DEFAULT NULL,
  p_risk_flags   jsonb DEFAULT '[]'::jsonb,
  p_provider     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.phone_verifications (
    user_id, phone_number, carrier_name, carrier_type,
    is_voip, is_prepaid, is_ported,
    risk_score, risk_flags, provider, verified_at
  ) VALUES (
    p_user_id, p_phone_number, p_carrier_name, p_carrier_type,
    p_is_voip, p_is_prepaid, p_is_ported,
    p_risk_score, p_risk_flags, p_provider, now()
  )
  ON CONFLICT (user_id, phone_number) DO UPDATE SET
    carrier_name = EXCLUDED.carrier_name,
    carrier_type = EXCLUDED.carrier_type,
    is_voip = EXCLUDED.is_voip,
    is_prepaid = EXCLUDED.is_prepaid,
    is_ported = EXCLUDED.is_ported,
    risk_score = EXCLUDED.risk_score,
    risk_flags = EXCLUDED.risk_flags,
    provider = EXCLUDED.provider,
    verified_at = now()
  RETURNING id INTO v_id;

  -- Update profile
  UPDATE public.profiles
  SET phone_verified_at = now(),
      phone_carrier_type = p_carrier_type
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'verification_id', v_id,
    'is_voip', p_is_voip,
    'risk_score', p_risk_score,
    'risk_level', CASE
      WHEN p_is_voip = true THEN 'high'
      WHEN COALESCE(p_risk_score, 50) < 30 THEN 'high'
      WHEN COALESCE(p_risk_score, 50) < 60 THEN 'medium'
      ELSE 'low'
    END
  );
END;
$$;

-- ── RPC: Get identity risk profile ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_identity_risk_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_profile    record;
  v_phone      record;
  v_id_checks  jsonb;
  v_risk_level text;
  v_flags      jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Latest phone verification
  SELECT * INTO v_phone FROM public.phone_verifications
    WHERE user_id = p_user_id
    ORDER BY verified_at DESC NULLS LAST LIMIT 1;

  -- Identity checks summary
  SELECT jsonb_agg(
    jsonb_build_object(
      'type', check_type,
      'status', status,
      'confidence', confidence,
      'provider', provider,
      'verified_at', verified_at,
      'expired', expires_at IS NOT NULL AND expires_at < now()
    )
  ) INTO v_id_checks
  FROM public.identity_verifications
  WHERE user_id = p_user_id
  ORDER BY created_at DESC;

  -- Build risk flags
  IF v_phone IS NOT NULL AND v_phone.is_voip = true THEN
    v_flags := v_flags || '"voip_phone_detected"'::jsonb;
  END IF;
  IF v_phone IS NOT NULL AND v_phone.is_ported = true THEN
    v_flags := v_flags || '"ported_number"'::jsonb;
  END IF;
  IF v_profile.phone_verified_at IS NULL THEN
    v_flags := v_flags || '"phone_not_verified"'::jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.identity_verifications
    WHERE user_id = p_user_id AND status = 'passed'
      AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    v_flags := v_flags || '"no_valid_identity_check"'::jsonb;
  END IF;

  -- Overall risk
  v_risk_level := CASE
    WHEN jsonb_array_length(v_flags) >= 3 THEN 'critical'
    WHEN jsonb_array_length(v_flags) >= 2 THEN 'high'
    WHEN jsonb_array_length(v_flags) >= 1 THEN 'medium'
    ELSE 'low'
  END;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'phone_verified', v_profile.phone_verified_at IS NOT NULL,
    'phone_carrier_type', v_profile.phone_carrier_type,
    'phone_risk', CASE
      WHEN v_phone IS NULL THEN NULL
      ELSE jsonb_build_object(
        'is_voip', v_phone.is_voip,
        'is_prepaid', v_phone.is_prepaid,
        'is_ported', v_phone.is_ported,
        'risk_score', v_phone.risk_score,
        'carrier_name', v_phone.carrier_name
      )
    END,
    'identity_checks', COALESCE(v_id_checks, '[]'::jsonb),
    'risk_flags', v_flags,
    'risk_level', v_risk_level
  );
END;
$$;

COMMIT;
