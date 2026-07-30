-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 014: Load Templates (Phase 13B)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.load_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id    UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  template_data JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS load_templates_user_idx    ON public.load_templates(user_id);
CREATE INDEX IF NOT EXISTS load_templates_company_idx ON public.load_templates(company_id);

ALTER TABLE public.load_templates ENABLE ROW LEVEL SECURITY;

-- User can manage their own templates
CREATE POLICY "owner_manage_templates" ON public.load_templates
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Company members can read company templates
CREATE POLICY "company_members_view_templates" ON public.load_templates
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_load_templates()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_load_templates ON public.load_templates;
CREATE TRIGGER trg_touch_load_templates
  BEFORE UPDATE ON public.load_templates
  FOR EACH ROW EXECUTE FUNCTION public.touch_load_templates();
