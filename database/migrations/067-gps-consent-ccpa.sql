-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 067: GPS Consent CCPA/CPRA (P1-09)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Server-side GPS consent tracking for California Consumer Privacy Act (CCPA)
-- and California Privacy Rights Act (CPRA) compliance.
--
-- Replaces the client-side localStorage consent with a persistent DB record.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE TABLE IF NOT EXISTS gps_consent (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted       boolean NOT NULL DEFAULT false,
  granted_at    timestamptz,
  revoked_at    timestamptz,
  consent_text  text NOT NULL,
  ip_address    text,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_gps_consent_user ON gps_consent(user_id);

ALTER TABLE gps_consent ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own consent
CREATE POLICY "users_select_own_consent" ON gps_consent
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_consent" ON gps_consent
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_consent" ON gps_consent
  FOR UPDATE USING (user_id = auth.uid());

-- Admin can read all for compliance audits
CREATE POLICY "admins_read_all_consent" ON gps_consent
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- RPC: Grant GPS consent (creates or updates consent record)
CREATE OR REPLACE FUNCTION public.grant_gps_consent(
  p_consent_text text,
  p_ip_address   text DEFAULT NULL,
  p_user_agent   text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_consent_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.gps_consent (user_id, granted, granted_at, consent_text, ip_address, user_agent)
  VALUES (auth.uid(), true, now(), p_consent_text, p_ip_address, p_user_agent)
  ON CONFLICT (user_id) DO UPDATE SET
    granted = true,
    granted_at = now(),
    revoked_at = NULL,
    consent_text = EXCLUDED.consent_text,
    ip_address = EXCLUDED.ip_address,
    user_agent = EXCLUDED.user_agent,
    updated_at = now()
  RETURNING id INTO v_consent_id;

  -- Audit log
  PERFORM public.write_audit_log(
    'consent_given',
    'gps_consent',
    v_consent_id::text,
    jsonb_build_object(
      'consent_text', p_consent_text,
      'granted_at', now()::text,
      'ip_address', p_ip_address
    ),
    p_ip_address
  );

  RETURN v_consent_id;
END;
$$;

-- RPC: Revoke GPS consent
CREATE OR REPLACE FUNCTION public.revoke_gps_consent()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_consent_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.gps_consent
  SET granted = false,
      revoked_at = now(),
      updated_at = now()
  WHERE user_id = auth.uid()
  RETURNING id INTO v_consent_id;

  IF v_consent_id IS NOT NULL THEN
    PERFORM public.write_audit_log(
      'consent_given',
      'gps_consent',
      v_consent_id::text,
      jsonb_build_object('action', 'revoked', 'revoked_at', now()::text),
      NULL
    );
  END IF;
END;
$$;

-- RPC: Check if user has active GPS consent (called before collecting location)
CREATE OR REPLACE FUNCTION public.has_gps_consent(p_user_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user uuid;
BEGIN
  v_user := COALESCE(p_user_id, auth.uid());
  RETURN EXISTS (
    SELECT 1 FROM public.gps_consent
    WHERE user_id = v_user
      AND granted = true
      AND revoked_at IS NULL
  );
END;
$$;

COMMIT;
