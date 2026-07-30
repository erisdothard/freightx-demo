-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 073: Two-Way Trust — Carriers Verify Brokers (P2-01)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Highway's differentiator: carriers can rate and review brokers, not just
-- the other way around. Builds carrier-side trust signals alongside the
-- existing broker_payment_metrics and broker_credit_score.
--
-- New tables:
--   broker_reviews — carrier-submitted reviews after load completion
--   broker_relationships — carrier-side preferred/blocked list for brokers
--
-- New RPCs:
--   get_broker_trust_profile(broker_company_id) — full trust card
--   submit_broker_review(params) — carrier submits review
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Broker reviews (carrier → broker) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS broker_reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  broker_company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  load_id             uuid NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  reviewer_id         uuid NOT NULL REFERENCES profiles(id),

  -- Carrier-specific rating categories (1-5)
  overall             integer NOT NULL CHECK (overall BETWEEN 1 AND 5),
  payment_speed       integer CHECK (payment_speed BETWEEN 1 AND 5),
  payment_reliability integer CHECK (payment_reliability BETWEEN 1 AND 5),
  communication       integer CHECK (communication BETWEEN 1 AND 5),
  rate_fairness       integer CHECK (rate_fairness BETWEEN 1 AND 5),

  comment             text CHECK (char_length(comment) <= 500),
  would_work_again    boolean,

  created_at          timestamptz NOT NULL DEFAULT now(),

  -- One review per carrier company per load
  UNIQUE (carrier_company_id, load_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_reviews_broker ON broker_reviews(broker_company_id);
CREATE INDEX IF NOT EXISTS idx_broker_reviews_carrier ON broker_reviews(carrier_company_id);
CREATE INDEX IF NOT EXISTS idx_broker_reviews_load ON broker_reviews(load_id);

ALTER TABLE broker_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read reviews (market transparency)
CREATE POLICY "anyone_read_broker_reviews" ON broker_reviews
  FOR SELECT USING (auth.role() = 'authenticated');

-- Carriers insert reviews via RPC (SECURITY DEFINER), not direct insert
CREATE POLICY "system_insert_broker_reviews" ON broker_reviews
  FOR INSERT WITH CHECK (false);

-- ── Broker relationships (carrier-side preferred/blocked) ─────────────────────
CREATE TABLE IF NOT EXISTS broker_relationships (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  broker_company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status              text NOT NULL DEFAULT 'preferred'
                        CHECK (status IN ('preferred', 'blocked')),
  notes               text CHECK (char_length(notes) <= 500),
  created_by          uuid REFERENCES profiles(id),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (carrier_company_id, broker_company_id)
);

CREATE INDEX IF NOT EXISTS idx_broker_rel_carrier ON broker_relationships(carrier_company_id);
CREATE INDEX IF NOT EXISTS idx_broker_rel_broker ON broker_relationships(broker_company_id);

ALTER TABLE broker_relationships ENABLE ROW LEVEL SECURITY;

-- Carrier company members can manage their broker relationships
CREATE POLICY "carrier_manage_broker_rel" ON broker_relationships
  FOR ALL USING (
    carrier_company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    carrier_company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Brokers can see their own relationship status with carriers
CREATE POLICY "broker_view_own_rel" ON broker_relationships
  FOR SELECT USING (
    broker_company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid()
    )
  );

-- ── RPC: Submit broker review ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_broker_review(
  p_load_id             uuid,
  p_overall             integer,
  p_payment_speed       integer DEFAULT NULL,
  p_payment_reliability integer DEFAULT NULL,
  p_communication       integer DEFAULT NULL,
  p_rate_fairness       integer DEFAULT NULL,
  p_comment             text DEFAULT NULL,
  p_would_work_again    boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_load         record;
  v_bid          record;
  v_carrier_co   uuid;
  v_review_id    uuid;
BEGIN
  -- Get the load
  SELECT id, company_id, status INTO v_load
    FROM public.loads WHERE id = p_load_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load not found';
  END IF;

  -- Load must be completed or delivered
  IF v_load.status NOT IN ('completed', 'delivered') THEN
    RAISE EXCEPTION 'Can only review after load completion';
  END IF;

  -- Get the carrier's accepted bid to confirm they worked this load
  SELECT b.company_id INTO v_carrier_co
    FROM public.bids b
   WHERE b.load_id = p_load_id
     AND b.status = 'accepted'
     AND b.company_id IN (
       SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
     );

  IF v_carrier_co IS NULL THEN
    RAISE EXCEPTION 'Only the carrier who completed this load can review the broker';
  END IF;

  INSERT INTO public.broker_reviews (
    carrier_company_id, broker_company_id, load_id, reviewer_id,
    overall, payment_speed, payment_reliability, communication,
    rate_fairness, comment, would_work_again
  ) VALUES (
    v_carrier_co, v_load.company_id, p_load_id, auth.uid(),
    p_overall, p_payment_speed, p_payment_reliability, p_communication,
    p_rate_fairness, p_comment, p_would_work_again
  )
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

-- ── RPC: Get broker trust profile ────────────────────────────────────────────
-- Aggregates carrier reviews + payment metrics into a single trust card
CREATE OR REPLACE FUNCTION public.get_broker_trust_profile(p_broker_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reviews   record;
  v_metrics   record;
  v_verified  boolean;
  v_company   record;
BEGIN
  -- Aggregate carrier reviews
  SELECT
    COUNT(*)::integer AS review_count,
    ROUND(AVG(overall)::numeric, 1) AS avg_overall,
    ROUND(AVG(payment_speed)::numeric, 1) AS avg_payment_speed,
    ROUND(AVG(payment_reliability)::numeric, 1) AS avg_payment_reliability,
    ROUND(AVG(communication)::numeric, 1) AS avg_communication,
    ROUND(AVG(rate_fairness)::numeric, 1) AS avg_rate_fairness,
    ROUND(100.0 * COUNT(*) FILTER (WHERE would_work_again = true) /
      NULLIF(COUNT(*) FILTER (WHERE would_work_again IS NOT NULL), 0), 0
    ) AS would_work_again_pct
  INTO v_reviews
  FROM public.broker_reviews
  WHERE broker_company_id = p_broker_company_id;

  -- Payment metrics
  SELECT avg_days_to_pay, on_time_pct, payment_count, total_paid_usd
    INTO v_metrics
    FROM public.broker_payment_metrics
   WHERE company_id = p_broker_company_id;

  -- Verification status
  SELECT public.check_broker_verified(p_broker_company_id) INTO v_verified;

  -- Company info
  SELECT name, rating, broker_bond_verified
    INTO v_company
    FROM public.companies WHERE id = p_broker_company_id;

  RETURN jsonb_build_object(
    'company_name', v_company.name,
    'verified', v_verified,
    'bond_verified', COALESCE(v_company.broker_bond_verified, false),
    'platform_rating', v_company.rating,
    'carrier_reviews', jsonb_build_object(
      'count', COALESCE(v_reviews.review_count, 0),
      'avg_overall', v_reviews.avg_overall,
      'avg_payment_speed', v_reviews.avg_payment_speed,
      'avg_payment_reliability', v_reviews.avg_payment_reliability,
      'avg_communication', v_reviews.avg_communication,
      'avg_rate_fairness', v_reviews.avg_rate_fairness,
      'would_work_again_pct', v_reviews.would_work_again_pct
    ),
    'payment_metrics', CASE
      WHEN v_metrics IS NULL THEN jsonb_build_object('has_data', false)
      ELSE jsonb_build_object(
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
      )
    END,
    'trust_grade', CASE
      WHEN v_reviews.review_count >= 10 AND v_reviews.avg_overall >= 4.5
        AND v_verified THEN 'A+'
      WHEN v_reviews.review_count >= 5 AND v_reviews.avg_overall >= 4.0 THEN 'A'
      WHEN v_reviews.review_count >= 3 AND v_reviews.avg_overall >= 3.5 THEN 'B'
      WHEN v_reviews.review_count >= 1 AND v_reviews.avg_overall >= 2.5 THEN 'C'
      WHEN v_reviews.review_count >= 1 THEN 'D'
      ELSE NULL  -- Not enough data
    END
  );
END;
$$;

COMMIT;
