-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 015: Accessorial Charges (Phase 13B)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.accessorial_charges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id     UUID NOT NULL REFERENCES public.loads(id) ON DELETE CASCADE,
  booking_id  UUID REFERENCES public.bids(id) ON DELETE SET NULL,
  type        TEXT NOT NULL,
  amount_usd  DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending|approved|denied
  created_by  UUID NOT NULL REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_type   CHECK (type   IN ('detention','lumper','layover','tonu','fuel_surcharge','other')),
  CONSTRAINT valid_status CHECK (status IN ('pending','approved','denied'))
);

CREATE INDEX IF NOT EXISTS accessorials_load_idx ON public.accessorial_charges(load_id);
CREATE INDEX IF NOT EXISTS accessorials_status_idx ON public.accessorial_charges(status);

ALTER TABLE public.accessorial_charges ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view charges on loads they are involved with
CREATE POLICY "participants_view_accessorials" ON public.accessorial_charges
  FOR SELECT USING (auth.role() = 'authenticated');

-- Carriers (created_by) can insert charges
CREATE POLICY "carrier_insert_accessorials" ON public.accessorial_charges
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Load posters (brokers) can approve/deny
CREATE POLICY "broker_update_accessorials" ON public.accessorial_charges
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.loads
       WHERE id = accessorial_charges.load_id
         AND posted_by = auth.uid()
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_accessorial_charges()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_accessorials ON public.accessorial_charges;
CREATE TRIGGER trg_touch_accessorials
  BEFORE UPDATE ON public.accessorial_charges
  FOR EACH ROW EXECUTE FUNCTION public.touch_accessorial_charges();

-- ── Add e-signature fields to bids table ────────────────────────────────────
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS signed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_url   TEXT,
  ADD COLUMN IF NOT EXISTS signatory_name  TEXT;
