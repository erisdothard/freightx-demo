-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 016: Saved Searches + Lane Alerts (Phase 13C)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  filters        JSONB NOT NULL DEFAULT '{}',
  alert_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  last_alerted_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS saved_searches_user_idx          ON public.saved_searches(user_id);
CREATE INDEX IF NOT EXISTS saved_searches_alert_enabled_idx ON public.saved_searches(alert_enabled)
  WHERE alert_enabled = TRUE;

ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner_all_saved_searches" ON public.saved_searches
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_saved_searches()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_saved_searches ON public.saved_searches;
CREATE TRIGGER trg_touch_saved_searches
  BEFORE UPDATE ON public.saved_searches
  FOR EACH ROW EXECUTE FUNCTION public.touch_saved_searches();
