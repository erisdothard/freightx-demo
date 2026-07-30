-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 011: Carrier Preferences (Phase 11 blocker)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.carrier_preferences (
  user_id                UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  preferred_equipment    TEXT[]      DEFAULT '{}',
  preferred_origin_states TEXT[]     DEFAULT '{}',
  preferred_dest_states  TEXT[]      DEFAULT '{}',
  min_rate_per_mile      DECIMAL(8,2) DEFAULT 0,
  home_city              TEXT        DEFAULT '',
  home_state             TEXT        DEFAULT '',
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.carrier_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all" ON public.carrier_preferences;
CREATE POLICY "owner_all" ON public.carrier_preferences
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_carrier_preferences()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_carrier_preferences ON public.carrier_preferences;
CREATE TRIGGER trg_touch_carrier_preferences
  BEFORE UPDATE ON public.carrier_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_carrier_preferences();
