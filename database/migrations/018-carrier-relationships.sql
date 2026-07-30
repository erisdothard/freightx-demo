-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 018: Carrier Relationships — Preferred/Blocked (Phase 13C)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.carrier_relationships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  carrier_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'preferred',  -- preferred|blocked
  notes       TEXT,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, carrier_id),
  CONSTRAINT valid_rel_status CHECK (status IN ('preferred', 'blocked'))
);

CREATE INDEX IF NOT EXISTS carrier_rel_company_idx ON public.carrier_relationships(company_id);
CREATE INDEX IF NOT EXISTS carrier_rel_carrier_idx ON public.carrier_relationships(carrier_id);
CREATE INDEX IF NOT EXISTS carrier_rel_status_idx  ON public.carrier_relationships(company_id, status);

ALTER TABLE public.carrier_relationships ENABLE ROW LEVEL SECURITY;

-- Brokers can manage their carrier relationships
CREATE POLICY "broker_manage_relationships" ON public.carrier_relationships
  FOR ALL USING (
    company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
      UNION
      SELECT company_id FROM public.company_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
      UNION
      SELECT company_id FROM public.company_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
    )
  );

-- Carriers can see their own relationship status with brokers
CREATE POLICY "carrier_view_own_status" ON public.carrier_relationships
  FOR SELECT USING (carrier_id = auth.uid());

-- ── add preferred_carriers_only flag to loads ────────────────────────────────
ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS preferred_carriers_only BOOLEAN NOT NULL DEFAULT FALSE;
