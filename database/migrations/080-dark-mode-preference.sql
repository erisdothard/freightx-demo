-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 080: Dark Mode User Preference (P2-08)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Persists dark mode preference per user. Frontend reads this on login
-- and applies the Tailwind dark: class to the root element.
--
-- Options: 'light', 'dark', 'system' (follows OS preference)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS theme text
  NOT NULL DEFAULT 'system'
  CHECK (theme IN ('light', 'dark', 'system'));

-- RPC: Update theme preference
CREATE OR REPLACE FUNCTION public.set_theme_preference(p_theme text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_theme NOT IN ('light', 'dark', 'system') THEN
    RAISE EXCEPTION 'Invalid theme. Must be light, dark, or system.';
  END IF;

  UPDATE public.profiles SET theme = p_theme WHERE id = auth.uid();
END;
$$;

COMMIT;
