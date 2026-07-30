-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 084: Open API / TMS Integration Keys (P3-04)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Enterprise broker gate. External TMS systems can programmatically:
--   - Post loads
--   - Query rates and availability
--   - Manage bids
--   - Retrieve documents and tracking data
--
-- Gated behind api_access feature flag (broker_growth + enterprise tiers).
--
-- API key schema:
--   - SHA-256 hashed keys (plaintext never stored)
--   - Scope-based access control (loads:read, loads:write, etc.)
--   - Per-key rate limits with tier defaults
--   - IP whitelisting for enterprise
--   - Usage audit trail
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── API keys table ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) <= 100),
  key_hash        text NOT NULL UNIQUE,    -- SHA-256 of the actual key
  key_prefix      text NOT NULL,           -- First 8 chars for identification (sk_frei...)
  scopes          text[] NOT NULL DEFAULT '{loads:read}',
  rate_limit_rpm  integer DEFAULT 100,     -- Requests per minute
  ip_whitelist    inet[],                  -- Optional IP allowlist
  expires_at      timestamptz,
  last_used_at    timestamptz,
  revoked_at      timestamptz,
  created_by      uuid NOT NULL REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_company ON api_keys(company_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(company_id)
  WHERE revoked_at IS NULL;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Company owners/admins manage their API keys
CREATE POLICY "company_manage_api_keys" ON api_keys
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── API key usage audit ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_key_usage (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id      uuid NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  endpoint        text NOT NULL,
  method          text NOT NULL,
  response_status integer,
  response_time_ms integer,
  ip_address      inet,
  user_agent      text,
  error_message   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Partition-friendly index for time-series queries
CREATE INDEX IF NOT EXISTS idx_api_usage_key ON api_key_usage(api_key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_time ON api_key_usage(created_at DESC);

ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_view_usage" ON api_key_usage
  FOR SELECT USING (
    api_key_id IN (
      SELECT id FROM api_keys WHERE company_id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- System can insert usage records
CREATE POLICY "system_insert_usage" ON api_key_usage
  FOR INSERT WITH CHECK (true);

-- ── RPC: Generate API key ────────────────────────────────────────────────────
-- Returns the plaintext key ONCE. It is never stored or retrievable again.
CREATE OR REPLACE FUNCTION public.generate_api_key(
  p_company_id  uuid,
  p_name        text,
  p_scopes      text[] DEFAULT '{loads:read}',
  p_rate_limit  integer DEFAULT NULL,
  p_ip_whitelist inet[] DEFAULT NULL,
  p_expires_in_days integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_access    jsonb;
  v_key_raw   text;
  v_key_hash  text;
  v_prefix    text;
  v_key_id    uuid;
  v_expires   timestamptz;
  v_valid_scopes text[] := ARRAY[
    'loads:read', 'loads:write',
    'bids:read', 'bids:write',
    'tracking:read',
    'documents:read',
    'rates:read',
    'webhooks:manage'
  ];
  v_scope     text;
BEGIN
  -- Check tier access
  v_access := public.check_feature_access(p_company_id, 'api_access');
  IF NOT (v_access->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error',
      'API access requires Broker Growth or Enterprise tier.');
  END IF;

  -- Verify caller has permission
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Validate scopes
  FOREACH v_scope IN ARRAY p_scopes
  LOOP
    IF NOT v_scope = ANY(v_valid_scopes) THEN
      RETURN jsonb_build_object('success', false, 'error',
        format('Invalid scope: %s. Valid: %s', v_scope, array_to_string(v_valid_scopes, ', ')));
    END IF;
  END LOOP;

  -- Generate key: sk_frei_ + 32 random bytes hex
  v_key_raw := 'sk_frei_' || encode(gen_random_bytes(32), 'hex');
  v_prefix := substring(v_key_raw from 1 for 16);
  v_key_hash := encode(digest(v_key_raw, 'sha256'), 'hex');

  v_expires := CASE
    WHEN p_expires_in_days IS NOT NULL THEN now() + (p_expires_in_days || ' days')::interval
    ELSE NULL
  END;

  INSERT INTO public.api_keys (
    company_id, name, key_hash, key_prefix, scopes,
    rate_limit_rpm, ip_whitelist, expires_at, created_by
  ) VALUES (
    p_company_id, p_name, v_key_hash, v_prefix, p_scopes,
    COALESCE(p_rate_limit, 100), p_ip_whitelist, v_expires, auth.uid()
  )
  RETURNING id INTO v_key_id;

  RETURN jsonb_build_object(
    'success', true,
    'key_id', v_key_id,
    'api_key', v_key_raw,  -- Only time the plaintext is returned
    'prefix', v_prefix,
    'scopes', p_scopes,
    'rate_limit_rpm', COALESCE(p_rate_limit, 100),
    'expires_at', v_expires,
    'warning', 'Save this key now. It cannot be retrieved again.'
  );
END;
$$;

-- ── RPC: Validate API key (called by edge functions) ─────────────────────────
CREATE OR REPLACE FUNCTION public.validate_api_key(
  p_key_raw    text,
  p_scope      text DEFAULT NULL,
  p_ip_address inet DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hash   text;
  v_key    record;
BEGIN
  v_hash := encode(digest(p_key_raw, 'sha256'), 'hex');

  SELECT * INTO v_key FROM public.api_keys
   WHERE key_hash = v_hash;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid API key');
  END IF;

  IF v_key.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'API key has been revoked');
  END IF;

  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'API key has expired');
  END IF;

  -- Check IP whitelist
  IF v_key.ip_whitelist IS NOT NULL AND array_length(v_key.ip_whitelist, 1) > 0 THEN
    IF p_ip_address IS NULL OR NOT p_ip_address = ANY(v_key.ip_whitelist) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'IP address not whitelisted');
    END IF;
  END IF;

  -- Check scope
  IF p_scope IS NOT NULL AND NOT p_scope = ANY(v_key.scopes) THEN
    RETURN jsonb_build_object('valid', false, 'error',
      format('Insufficient scope. Required: %s', p_scope));
  END IF;

  -- Update last_used_at
  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_key.id;

  RETURN jsonb_build_object(
    'valid', true,
    'key_id', v_key.id,
    'company_id', v_key.company_id,
    'scopes', v_key.scopes,
    'rate_limit_rpm', v_key.rate_limit_rpm
  );
END;
$$;

-- ── RPC: Revoke API key ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.api_keys
  SET revoked_at = now()
  WHERE id = p_key_id
    AND company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    );
END;
$$;

-- ── RPC: Get API usage stats ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_api_usage_stats(
  p_company_id uuid,
  p_days       integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stats record;
BEGIN
  SELECT
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE response_status < 400) AS successful,
    COUNT(*) FILTER (WHERE response_status >= 400) AS failed,
    ROUND(AVG(response_time_ms)::numeric) AS avg_response_ms,
    COUNT(DISTINCT api_key_id) AS active_keys
  INTO v_stats
  FROM public.api_key_usage u
  JOIN public.api_keys k ON k.id = u.api_key_id
  WHERE k.company_id = p_company_id
    AND u.created_at >= now() - (p_days || ' days')::interval;

  RETURN jsonb_build_object(
    'period_days', p_days,
    'total_requests', COALESCE(v_stats.total_requests, 0),
    'successful', COALESCE(v_stats.successful, 0),
    'failed', COALESCE(v_stats.failed, 0),
    'avg_response_ms', v_stats.avg_response_ms,
    'active_keys', COALESCE(v_stats.active_keys, 0)
  );
END;
$$;

COMMIT;
