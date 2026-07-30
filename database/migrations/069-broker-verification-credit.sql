-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 069: Broker Verification + Auto Credit Score (P1-01/P1-05)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- P1-01: Broker FMCSA verification — reuses carrier_verifications for brokers
-- P1-05: Auto-populate broker_credit_score on load posting from payment metrics
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- P1-01: BROKER FMCSA VERIFICATION
-- Brokers use the same carrier_verifications table (keyed by company_id).
-- A broker company can have a verification record with MC/FMCSA data.
-- ═══════════════════════════════════════════════════════════════════════════

-- Check if a broker company is verified (MC active, bond verified)
CREATE OR REPLACE FUNCTION public.check_broker_verified(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company record;
  v_verif   record;
BEGIN
  SELECT type, broker_bond_verified, broker_bond_expires_at
    INTO v_company
    FROM public.companies WHERE id = p_company_id;

  IF NOT FOUND THEN RETURN false; END IF;

  -- Non-broker companies skip broker verification
  IF v_company.type != 'broker' THEN RETURN true; END IF;

  -- Check FMCSA verification exists
  SELECT status, fmcsa_status INTO v_verif
    FROM public.carrier_verifications
   WHERE company_id = p_company_id;

  IF NOT FOUND THEN RETURN false; END IF;

  RETURN (
    v_verif.status = 'verified'
    AND v_verif.fmcsa_status = 'AUTHORIZED'
    AND v_company.broker_bond_verified = true
    AND (v_company.broker_bond_expires_at IS NULL
      OR v_company.broker_bond_expires_at > CURRENT_DATE)
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- P1-05: AUTO-POPULATE BROKER CREDIT SCORE ON LOAD POSTING
-- When a load is inserted, pull the broker's credit score from payment metrics.
-- Score = weighted formula: 60% on_time_pct + 40% speed_score (based on avg_days_to_pay)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.auto_populate_broker_credit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_metrics  record;
  v_speed    numeric;
  v_score    integer;
BEGIN
  -- Only populate if not already set and company_id exists
  IF NEW.broker_credit_score IS NOT NULL OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT avg_days_to_pay, on_time_pct, payment_count
    INTO v_metrics
    FROM public.broker_payment_metrics
   WHERE company_id = NEW.company_id;

  IF NOT FOUND OR v_metrics.payment_count < 3 THEN
    -- Not enough data for a reliable score
    RETURN NEW;
  END IF;

  -- Speed score: faster pay = higher score
  --   0-7 days = 100, 8-14 = 85, 15-21 = 70, 22-30 = 55, 31+ = 30
  v_speed := CASE
    WHEN v_metrics.avg_days_to_pay <= 7  THEN 100
    WHEN v_metrics.avg_days_to_pay <= 14 THEN 85
    WHEN v_metrics.avg_days_to_pay <= 21 THEN 70
    WHEN v_metrics.avg_days_to_pay <= 30 THEN 55
    ELSE 30
  END;

  -- Composite: 60% on-time reliability + 40% payment speed
  v_score := ROUND(v_metrics.on_time_pct * 0.6 + v_speed * 0.4);
  v_score := LEAST(GREATEST(v_score, 0), 100);

  NEW.broker_credit_score := v_score;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_broker_credit_trigger ON loads;
CREATE TRIGGER auto_broker_credit_trigger
  BEFORE INSERT ON loads
  FOR EACH ROW EXECUTE FUNCTION auto_populate_broker_credit();

-- ═══════════════════════════════════════════════════════════════════════════
-- DAYS-TO-PAY HELPER: Carrier-facing label for broker payment speed
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_broker_payment_summary(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_metrics record;
BEGIN
  SELECT avg_days_to_pay, on_time_pct, payment_count, total_paid_usd
    INTO v_metrics
    FROM public.broker_payment_metrics
   WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('has_data', false);
  END IF;

  RETURN jsonb_build_object(
    'has_data', true,
    'avg_days_to_pay', v_metrics.avg_days_to_pay,
    'on_time_pct', v_metrics.on_time_pct,
    'payment_count', v_metrics.payment_count,
    'total_paid_usd', v_metrics.total_paid_usd,
    'pay_speed_label', CASE
      WHEN v_metrics.avg_days_to_pay <= 7  THEN 'Quick Pay (< 7 days)'
      WHEN v_metrics.avg_days_to_pay <= 14 THEN 'Fast Pay (< 14 days)'
      WHEN v_metrics.avg_days_to_pay <= 21 THEN 'Standard (< 21 days)'
      WHEN v_metrics.avg_days_to_pay <= 30 THEN 'Net-30'
      ELSE 'Slow Pay (30+ days)'
    END
  );
END;
$$;

COMMIT;
