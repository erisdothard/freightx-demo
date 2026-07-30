-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 017: Broker Payment Metrics (Phase 13C)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.broker_payment_metrics (
  company_id      UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  avg_days_to_pay DECIMAL(5,1) DEFAULT 0,
  payment_count   INTEGER NOT NULL DEFAULT 0,
  on_time_pct     DECIMAL(5,2) DEFAULT 100,  -- 0-100
  total_paid_usd  DECIMAL(12,2) DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.broker_payment_metrics ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read broker metrics (carrier trust signal)
CREATE POLICY "authenticated_view_metrics" ON public.broker_payment_metrics
  FOR SELECT USING (auth.role() = 'authenticated');

-- Only service role can write (auto-updated by payment events)
CREATE POLICY "service_manage_metrics" ON public.broker_payment_metrics
  FOR ALL USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── RPC: record_broker_payment ───────────────────────────────────────────────
-- Called after each payment event to update rolling averages.
CREATE OR REPLACE FUNCTION public.record_broker_payment(
  p_company_id  UUID,
  p_days_to_pay INT,
  p_on_time     BOOLEAN,
  p_amount_usd  DECIMAL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_cur RECORD;
BEGIN
  SELECT * INTO v_cur FROM public.broker_payment_metrics WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    INSERT INTO public.broker_payment_metrics
      (company_id, avg_days_to_pay, payment_count, on_time_pct, total_paid_usd, updated_at)
    VALUES
      (p_company_id, p_days_to_pay, 1,
       CASE WHEN p_on_time THEN 100 ELSE 0 END,
       p_amount_usd, NOW());
  ELSE
    UPDATE public.broker_payment_metrics SET
      avg_days_to_pay = (v_cur.avg_days_to_pay * v_cur.payment_count + p_days_to_pay)
                        / (v_cur.payment_count + 1),
      on_time_pct     = CASE WHEN p_on_time
                             THEN (v_cur.on_time_pct * v_cur.payment_count + 100) / (v_cur.payment_count + 1)
                             ELSE (v_cur.on_time_pct * v_cur.payment_count)       / (v_cur.payment_count + 1)
                        END,
      payment_count   = v_cur.payment_count + 1,
      total_paid_usd  = v_cur.total_paid_usd + p_amount_usd,
      updated_at      = NOW()
    WHERE company_id = p_company_id;
  END IF;
END;
$$;

-- ── Seed initial metrics for existing companies (nulls = no data yet) ────────
INSERT INTO public.broker_payment_metrics (company_id)
SELECT id FROM public.companies WHERE type = 'broker'
ON CONFLICT DO NOTHING;
