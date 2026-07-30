-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 087: Mobile Device Registry (P4-01)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Backend infrastructure for native mobile app. Tracks registered devices,
-- app versions, and platform-specific push tokens (APNs / FCM).
--
-- Tables:
--   mobile_devices — registered device instances
--
-- RPCs:
--   register_mobile_device() — register or update device on login
--   deregister_mobile_device() — remove device on logout
--   get_my_devices() — list user's registered devices
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Mobile devices ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mobile_devices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id       text NOT NULL,                -- Vendor device ID / fingerprint
  platform        text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  app_version     text,                         -- e.g., '1.2.0'
  os_version      text,                         -- e.g., 'iOS 18.1', 'Android 15'
  device_model    text,                         -- e.g., 'iPhone 16 Pro', 'Pixel 9'
  push_token      text,                         -- APNs / FCM token
  push_enabled    boolean NOT NULL DEFAULT true,
  locale          text DEFAULT 'en',
  timezone        text DEFAULT 'America/Chicago',
  last_active_at  timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_devices_user ON mobile_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_platform ON mobile_devices(platform);
CREATE INDEX IF NOT EXISTS idx_mobile_devices_active ON mobile_devices(last_active_at DESC);

ALTER TABLE mobile_devices ENABLE ROW LEVEL SECURITY;

-- Users manage their own devices
CREATE POLICY "user_manage_own_devices" ON mobile_devices
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── RPC: Register mobile device ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_mobile_device(
  p_device_id    text,
  p_platform     text,
  p_push_token   text DEFAULT NULL,
  p_app_version  text DEFAULT NULL,
  p_os_version   text DEFAULT NULL,
  p_device_model text DEFAULT NULL,
  p_locale       text DEFAULT 'en',
  p_timezone     text DEFAULT 'America/Chicago'
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_device_id uuid;
BEGIN
  INSERT INTO public.mobile_devices (
    user_id, device_id, platform, push_token,
    app_version, os_version, device_model,
    locale, timezone, last_active_at
  ) VALUES (
    auth.uid(), p_device_id, p_platform, p_push_token,
    p_app_version, p_os_version, p_device_model,
    p_locale, p_timezone, now()
  )
  ON CONFLICT (user_id, device_id) DO UPDATE SET
    platform = EXCLUDED.platform,
    push_token = EXCLUDED.push_token,
    app_version = EXCLUDED.app_version,
    os_version = EXCLUDED.os_version,
    device_model = EXCLUDED.device_model,
    locale = EXCLUDED.locale,
    timezone = EXCLUDED.timezone,
    last_active_at = now()
  RETURNING id INTO v_device_id;

  RETURN v_device_id;
END;
$$;

-- ── RPC: Deregister mobile device ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.deregister_mobile_device(p_device_id text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.mobile_devices
  WHERE user_id = auth.uid() AND device_id = p_device_id;
END;
$$;

-- ── RPC: Get my devices ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_devices()
RETURNS TABLE (
  id            uuid,
  device_id     text,
  platform      text,
  app_version   text,
  device_model  text,
  push_enabled  boolean,
  last_active_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT md.id, md.device_id, md.platform, md.app_version,
         md.device_model, md.push_enabled, md.last_active_at
  FROM public.mobile_devices md
  WHERE md.user_id = auth.uid()
  ORDER BY md.last_active_at DESC;
END;
$$;

COMMIT;
