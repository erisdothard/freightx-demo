-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 089: Factoring Risk Management (P4-03)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Full risk underwriting for factoring. Dynamic scoring based on carrier
-- history, broker creditworthiness, and load characteristics. Enables
-- auto-approve for low-risk requests and flags high-risk for manual review.
--
-- Tables:
--   factoring_risk_assessments — risk score per factoring request
--   factoring_exposure_limits — max outstanding per company
--
-- RPCs:
--   assess_factoring_risk() — score a factoring request
--   get_factoring_exposure() — current outstanding + limits
--   set_factoring_exposure_limit() — admin sets company limit
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Risk assessments ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS factoring_risk_assessments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factoring_request_id uuid NOT NULL REFERENCES factoring_requests(id) ON DELETE CASCADE,
  carrier_company_id  uuid NOT NULL REFERENCES companies(id),
  broker_company_id   uuid REFERENCES companies(id),
  load_id             uuid NOT NULL REFERENCES loads(id),

  -- Scoring components (0-100 each)
  carrier_history_score   integer NOT NULL DEFAULT 0,  -- Payment history, on-time delivery
  broker_credit_score     integer NOT NULL DEFAULT 0,  -- Broker's payment reliability
  load_risk_score         integer NOT NULL DEFAULT 0,  -- Load value, distance, commodity
  verification_score      integer NOT NULL DEFAULT 0,  -- Carrier verification completeness
  relationship_score      integer NOT NULL DEFAULT 0,  -- Platform tenure + load count

  -- Composite
  overall_risk_score  integer NOT NULL DEFAULT 0,       -- Weighted composite (0-100, lower = riskier)
  risk_level          text NOT NULL DEFAULT 'medium'
                        CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  decision            text NOT NULL DEFAULT 'manual_review'
                        CHECK (decision IN ('auto_approve', 'manual_review', 'auto_deny')),
  decision_reasons    jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Fee adjustment
  base_fee_pct        numeric(4,2) NOT NULL DEFAULT 2.50,
  adjusted_fee_pct    numeric(4,2) NOT NULL DEFAULT 2.50,  -- Risk-adjusted fee

  assessed_at         timestamptz NOT NULL DEFAULT now(),
  assessed_by         text NOT NULL DEFAULT 'system',      -- 'system' or admin user_id

  UNIQUE (factoring_request_id)
);

CREATE INDEX IF NOT EXISTS idx_risk_assess_carrier ON factoring_risk_assessments(carrier_company_id);
CREATE INDEX IF NOT EXISTS idx_risk_assess_level ON factoring_risk_assessments(risk_level);

ALTER TABLE factoring_risk_assessments ENABLE ROW LEVEL SECURITY;

-- Admins view risk assessments
CREATE POLICY "admin_view_risk" ON factoring_risk_assessments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- System inserts
CREATE POLICY "system_insert_risk" ON factoring_risk_assessments
  FOR INSERT WITH CHECK (true);

-- ── Exposure limits ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS factoring_exposure_limits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  max_outstanding_usd numeric(12,2) NOT NULL DEFAULT 50000.00,
  max_single_invoice_usd numeric(10,2) NOT NULL DEFAULT 25000.00,
  min_risk_score    integer NOT NULL DEFAULT 30,       -- Below this = auto-deny
  auto_approve_above integer NOT NULL DEFAULT 70,      -- Above this = auto-approve
  updated_by        uuid REFERENCES profiles(id),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE factoring_exposure_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_limits" ON factoring_exposure_limits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── RPC: Assess factoring risk ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assess_factoring_risk(
  p_factoring_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req           record;
  v_carrier       record;
  v_broker_credit numeric;
  v_load          record;
  v_carrier_stats record;
  v_exposure      record;
  v_limits        record;
  v_scores        record;
  v_overall       integer;
  v_level         text;
  v_decision      text;
  v_reasons       jsonb := '[]'::jsonb;
  v_adj_fee       numeric;
BEGIN
  -- Get factoring request
  SELECT * INTO v_req FROM public.factoring_requests WHERE id = p_factoring_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  -- Get carrier verification data
  SELECT cv.*, c.total_loads, c.rating, c.created_at AS company_created
    INTO v_carrier
    FROM public.companies c
    LEFT JOIN public.carrier_verifications cv ON cv.company_id = c.id
   WHERE c.id = v_req.company_id;

  -- Get load
  SELECT * INTO v_load FROM public.loads WHERE id = v_req.load_id;

  -- Carrier history score (0-100)
  -- Based on: completed loads, platform tenure, on-time performance
  SELECT
    COUNT(*) FILTER (WHERE status IN ('completed', 'delivered'))::integer AS completed,
    COUNT(*) FILTER (WHERE status = 'completed' AND
      delivered_at <= delivery_date + interval '1 day')::integer AS on_time,
    COUNT(*)::integer AS total
  INTO v_carrier_stats
  FROM public.loads l
  JOIN public.bids b ON b.load_id = l.id AND b.status = 'accepted'
  WHERE b.company_id = v_req.company_id;

  v_scores.carrier_history := LEAST(100, GREATEST(0,
    CASE
      WHEN COALESCE(v_carrier_stats.completed, 0) = 0 THEN 20
      WHEN v_carrier_stats.completed >= 50 THEN 90
      WHEN v_carrier_stats.completed >= 20 THEN 70
      WHEN v_carrier_stats.completed >= 10 THEN 55
      WHEN v_carrier_stats.completed >= 5  THEN 40
      ELSE 25
    END
  ));

  -- Broker credit score (0-100)
  SELECT broker_credit_score INTO v_broker_credit
    FROM public.loads WHERE id = v_req.load_id;

  v_scores.broker_credit := LEAST(100, GREATEST(0,
    COALESCE(v_broker_credit * 10, 50)::integer  -- Scale 0-10 to 0-100
  ));

  -- Load risk score (0-100, higher = safer)
  v_scores.load_risk := CASE
    WHEN v_req.invoice_amount > 25000 THEN 30
    WHEN v_req.invoice_amount > 10000 THEN 50
    WHEN v_req.invoice_amount > 5000  THEN 70
    ELSE 85
  END;

  -- Verification score (0-100)
  v_scores.verification := CASE
    WHEN v_carrier.verification_status = 'verified' THEN 90
    WHEN v_carrier.verification_status = 'pending' THEN 40
    ELSE 20
  END;

  -- Relationship score (0-100)
  v_scores.relationship := LEAST(100,
    COALESCE(EXTRACT(EPOCH FROM (now() - v_carrier.company_created)) / 86400 / 3, 0)::integer
    + COALESCE(v_carrier.total_loads * 2, 0)
  );

  -- Weighted composite: carrier 30%, broker 25%, load 20%, verification 15%, relationship 10%
  v_overall := (
    v_scores.carrier_history * 30 +
    v_scores.broker_credit * 25 +
    v_scores.load_risk * 20 +
    v_scores.verification * 15 +
    v_scores.relationship * 10
  ) / 100;

  -- Risk level
  v_level := CASE
    WHEN v_overall >= 75 THEN 'low'
    WHEN v_overall >= 50 THEN 'medium'
    WHEN v_overall >= 30 THEN 'high'
    ELSE 'critical'
  END;

  -- Get exposure limits
  SELECT * INTO v_limits FROM public.factoring_exposure_limits
    WHERE company_id = v_req.company_id;

  -- Check exposure
  SELECT COALESCE(SUM(invoice_amount), 0) INTO v_exposure.outstanding
    FROM public.factoring_requests
    WHERE company_id = v_req.company_id
      AND status IN ('approved', 'funded')
      AND id != p_factoring_request_id;

  -- Build decision reasons
  IF v_scores.carrier_history < 30 THEN
    v_reasons := v_reasons || '"Low carrier history score"'::jsonb;
  END IF;
  IF v_scores.broker_credit < 40 THEN
    v_reasons := v_reasons || '"Broker credit risk"'::jsonb;
  END IF;
  IF v_scores.verification < 50 THEN
    v_reasons := v_reasons || '"Incomplete carrier verification"'::jsonb;
  END IF;
  IF v_limits IS NOT NULL AND v_exposure.outstanding + v_req.invoice_amount > v_limits.max_outstanding_usd THEN
    v_reasons := v_reasons || '"Exceeds exposure limit"'::jsonb;
    v_level := 'critical';
  END IF;
  IF v_limits IS NOT NULL AND v_req.invoice_amount > v_limits.max_single_invoice_usd THEN
    v_reasons := v_reasons || '"Exceeds single invoice limit"'::jsonb;
  END IF;

  -- Decision
  v_decision := CASE
    WHEN v_level = 'critical' THEN 'auto_deny'
    WHEN v_limits IS NOT NULL AND v_overall >= v_limits.auto_approve_above THEN 'auto_approve'
    WHEN v_limits IS NULL AND v_overall >= 70 THEN 'auto_approve'
    WHEN v_limits IS NOT NULL AND v_overall < v_limits.min_risk_score THEN 'auto_deny'
    WHEN v_limits IS NULL AND v_overall < 30 THEN 'auto_deny'
    ELSE 'manual_review'
  END;

  -- Fee adjustment: low risk = base, high risk = +0.5%, critical = denied
  v_adj_fee := CASE
    WHEN v_level = 'low' THEN v_req.fee_percent
    WHEN v_level = 'medium' THEN v_req.fee_percent + 0.25
    WHEN v_level = 'high' THEN v_req.fee_percent + 0.75
    ELSE v_req.fee_percent + 1.50
  END;

  -- Store assessment
  INSERT INTO public.factoring_risk_assessments (
    factoring_request_id, carrier_company_id, broker_company_id, load_id,
    carrier_history_score, broker_credit_score, load_risk_score,
    verification_score, relationship_score,
    overall_risk_score, risk_level, decision, decision_reasons,
    base_fee_pct, adjusted_fee_pct
  ) VALUES (
    p_factoring_request_id, v_req.company_id, v_req.broker_company_id, v_req.load_id,
    v_scores.carrier_history, v_scores.broker_credit, v_scores.load_risk,
    v_scores.verification, v_scores.relationship,
    v_overall, v_level, v_decision, v_reasons,
    v_req.fee_percent, v_adj_fee
  )
  ON CONFLICT (factoring_request_id) DO UPDATE SET
    carrier_history_score = EXCLUDED.carrier_history_score,
    broker_credit_score = EXCLUDED.broker_credit_score,
    load_risk_score = EXCLUDED.load_risk_score,
    verification_score = EXCLUDED.verification_score,
    relationship_score = EXCLUDED.relationship_score,
    overall_risk_score = EXCLUDED.overall_risk_score,
    risk_level = EXCLUDED.risk_level,
    decision = EXCLUDED.decision,
    decision_reasons = EXCLUDED.decision_reasons,
    adjusted_fee_pct = EXCLUDED.adjusted_fee_pct,
    assessed_at = now();

  -- Auto-approve if decision says so
  IF v_decision = 'auto_approve' THEN
    UPDATE public.factoring_requests
    SET status = 'approved', approved_at = now(), fee_percent = v_adj_fee
    WHERE id = p_factoring_request_id AND status = 'requested';
  END IF;

  -- Auto-deny if decision says so
  IF v_decision = 'auto_deny' THEN
    UPDATE public.factoring_requests
    SET status = 'denied'
    WHERE id = p_factoring_request_id AND status = 'requested';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'overall_score', v_overall,
    'risk_level', v_level,
    'decision', v_decision,
    'reasons', v_reasons,
    'base_fee_pct', v_req.fee_percent,
    'adjusted_fee_pct', v_adj_fee,
    'scores', jsonb_build_object(
      'carrier_history', v_scores.carrier_history,
      'broker_credit', v_scores.broker_credit,
      'load_risk', v_scores.load_risk,
      'verification', v_scores.verification,
      'relationship', v_scores.relationship
    )
  );
END;
$$;

-- ── RPC: Get factoring exposure ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_factoring_exposure(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_outstanding numeric;
  v_limits      record;
  v_stats       record;
BEGIN
  SELECT COALESCE(SUM(invoice_amount), 0) INTO v_outstanding
    FROM public.factoring_requests
    WHERE company_id = p_company_id AND status IN ('approved', 'funded');

  SELECT * INTO v_limits FROM public.factoring_exposure_limits
    WHERE company_id = p_company_id;

  SELECT
    COUNT(*)::integer AS total_requests,
    COUNT(*) FILTER (WHERE status = 'denied')::integer AS denied_count,
    ROUND(AVG(fra.overall_risk_score)::numeric) AS avg_risk_score
  INTO v_stats
  FROM public.factoring_requests fr
  LEFT JOIN public.factoring_risk_assessments fra ON fra.factoring_request_id = fr.id
  WHERE fr.company_id = p_company_id;

  RETURN jsonb_build_object(
    'company_id', p_company_id,
    'outstanding_usd', v_outstanding,
    'max_outstanding_usd', COALESCE(v_limits.max_outstanding_usd, 50000),
    'max_single_invoice_usd', COALESCE(v_limits.max_single_invoice_usd, 25000),
    'utilization_pct', ROUND(v_outstanding / COALESCE(v_limits.max_outstanding_usd, 50000) * 100, 1),
    'total_requests', COALESCE(v_stats.total_requests, 0),
    'denied_count', COALESCE(v_stats.denied_count, 0),
    'avg_risk_score', v_stats.avg_risk_score
  );
END;
$$;

-- ── RPC: Set exposure limit ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_factoring_exposure_limit(
  p_company_id          uuid,
  p_max_outstanding     numeric DEFAULT 50000,
  p_max_single_invoice  numeric DEFAULT 25000,
  p_min_risk_score      integer DEFAULT 30,
  p_auto_approve_above  integer DEFAULT 70
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.factoring_exposure_limits (
    company_id, max_outstanding_usd, max_single_invoice_usd,
    min_risk_score, auto_approve_above, updated_by
  ) VALUES (
    p_company_id, p_max_outstanding, p_max_single_invoice,
    p_min_risk_score, p_auto_approve_above, auth.uid()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    max_outstanding_usd = EXCLUDED.max_outstanding_usd,
    max_single_invoice_usd = EXCLUDED.max_single_invoice_usd,
    min_risk_score = EXCLUDED.min_risk_score,
    auto_approve_above = EXCLUDED.auto_approve_above,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
END;
$$;

COMMIT;
