-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 083: Carrier-Rated Scorecards (P3-03)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Network effect flywheel: carriers rate shippers AND brokers after each load.
-- Combined with broker_reviews (P2-01) and ratings (migration 007), creates
-- a complete two-way trust marketplace.
--
-- New tables:
--   shipper_reviews — carrier-submitted shipper reviews
--
-- New RPCs:
--   submit_shipper_review() — carrier reviews shipper
--   get_shipper_trust_profile() — aggregated shipper score card
--   get_marketplace_trust_summary() — company trust overview (any type)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Shipper reviews (carrier → shipper) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS shipper_reviews (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  shipper_company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  load_id             uuid NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  reviewer_id         uuid NOT NULL REFERENCES profiles(id),

  overall             integer NOT NULL CHECK (overall BETWEEN 1 AND 5),
  loading_efficiency  integer CHECK (loading_efficiency BETWEEN 1 AND 5),
  dock_wait_time      integer CHECK (dock_wait_time BETWEEN 1 AND 5),
  communication       integer CHECK (communication BETWEEN 1 AND 5),
  facility_quality    integer CHECK (facility_quality BETWEEN 1 AND 5),
  accuracy            integer CHECK (accuracy BETWEEN 1 AND 5),  -- weight/dims accurate?

  comment             text CHECK (char_length(comment) <= 500),
  detention_occurred  boolean,
  detention_minutes   integer,
  would_work_again    boolean,

  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (carrier_company_id, load_id)
);

CREATE INDEX IF NOT EXISTS idx_shipper_reviews_shipper ON shipper_reviews(shipper_company_id);
CREATE INDEX IF NOT EXISTS idx_shipper_reviews_carrier ON shipper_reviews(carrier_company_id);

ALTER TABLE shipper_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_shipper_reviews" ON shipper_reviews
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert via RPC only
CREATE POLICY "system_insert_shipper_reviews" ON shipper_reviews
  FOR INSERT WITH CHECK (false);

-- ── RPC: Submit shipper review ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_shipper_review(
  p_load_id             uuid,
  p_overall             integer,
  p_loading_efficiency  integer DEFAULT NULL,
  p_dock_wait_time      integer DEFAULT NULL,
  p_communication       integer DEFAULT NULL,
  p_facility_quality    integer DEFAULT NULL,
  p_accuracy            integer DEFAULT NULL,
  p_comment             text DEFAULT NULL,
  p_detention_occurred  boolean DEFAULT NULL,
  p_detention_minutes   integer DEFAULT NULL,
  p_would_work_again    boolean DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_load         record;
  v_carrier_co   uuid;
  v_review_id    uuid;
BEGIN
  SELECT id, company_id, status INTO v_load
    FROM public.loads WHERE id = p_load_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Load not found'; END IF;

  IF v_load.status NOT IN ('completed', 'delivered') THEN
    RAISE EXCEPTION 'Can only review after load completion';
  END IF;

  -- Confirm caller's company was the carrier on this load
  SELECT b.company_id INTO v_carrier_co
    FROM public.bids b
   WHERE b.load_id = p_load_id AND b.status = 'accepted'
     AND b.company_id IN (
       SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
     );

  IF v_carrier_co IS NULL THEN
    RAISE EXCEPTION 'Only the carrier who completed this load can review the shipper';
  END IF;

  INSERT INTO public.shipper_reviews (
    carrier_company_id, shipper_company_id, load_id, reviewer_id,
    overall, loading_efficiency, dock_wait_time, communication,
    facility_quality, accuracy, comment,
    detention_occurred, detention_minutes, would_work_again
  ) VALUES (
    v_carrier_co, v_load.company_id, p_load_id, auth.uid(),
    p_overall, p_loading_efficiency, p_dock_wait_time, p_communication,
    p_facility_quality, p_accuracy, p_comment,
    p_detention_occurred, p_detention_minutes, p_would_work_again
  )
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

-- ── RPC: Get shipper trust profile ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_shipper_trust_profile(p_shipper_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reviews record;
  v_company record;
BEGIN
  SELECT
    COUNT(*)::integer AS review_count,
    ROUND(AVG(overall)::numeric, 1) AS avg_overall,
    ROUND(AVG(loading_efficiency)::numeric, 1) AS avg_loading_efficiency,
    ROUND(AVG(dock_wait_time)::numeric, 1) AS avg_dock_wait_time,
    ROUND(AVG(communication)::numeric, 1) AS avg_communication,
    ROUND(AVG(facility_quality)::numeric, 1) AS avg_facility_quality,
    ROUND(AVG(accuracy)::numeric, 1) AS avg_accuracy,
    ROUND(100.0 * COUNT(*) FILTER (WHERE would_work_again = true) /
      NULLIF(COUNT(*) FILTER (WHERE would_work_again IS NOT NULL), 0), 0
    ) AS would_work_again_pct,
    ROUND(AVG(detention_minutes) FILTER (WHERE detention_occurred = true)::numeric, 0
    ) AS avg_detention_minutes,
    COUNT(*) FILTER (WHERE detention_occurred = true)::integer AS detention_count
  INTO v_reviews
  FROM public.shipper_reviews
  WHERE shipper_company_id = p_shipper_company_id;

  SELECT name, rating INTO v_company
    FROM public.companies WHERE id = p_shipper_company_id;

  RETURN jsonb_build_object(
    'company_name', v_company.name,
    'platform_rating', v_company.rating,
    'carrier_reviews', jsonb_build_object(
      'count', COALESCE(v_reviews.review_count, 0),
      'avg_overall', v_reviews.avg_overall,
      'avg_loading_efficiency', v_reviews.avg_loading_efficiency,
      'avg_dock_wait_time', v_reviews.avg_dock_wait_time,
      'avg_communication', v_reviews.avg_communication,
      'avg_facility_quality', v_reviews.avg_facility_quality,
      'avg_accuracy', v_reviews.avg_accuracy,
      'would_work_again_pct', v_reviews.would_work_again_pct,
      'detention_count', v_reviews.detention_count,
      'avg_detention_minutes', v_reviews.avg_detention_minutes
    ),
    'trust_grade', CASE
      WHEN v_reviews.review_count >= 10 AND v_reviews.avg_overall >= 4.5 THEN 'A+'
      WHEN v_reviews.review_count >= 5 AND v_reviews.avg_overall >= 4.0 THEN 'A'
      WHEN v_reviews.review_count >= 3 AND v_reviews.avg_overall >= 3.5 THEN 'B'
      WHEN v_reviews.review_count >= 1 AND v_reviews.avg_overall >= 2.5 THEN 'C'
      WHEN v_reviews.review_count >= 1 THEN 'D'
      ELSE NULL
    END
  );
END;
$$;

-- ── RPC: Unified trust summary for any company ───────────────────────────────
CREATE OR REPLACE FUNCTION public.get_marketplace_trust_summary(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company record;
  v_broker  jsonb;
  v_shipper jsonb;
BEGIN
  SELECT id, name, type, rating, total_loads
    INTO v_company FROM public.companies WHERE id = p_company_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Company not found');
  END IF;

  -- Broker trust profile (if applicable)
  IF v_company.type IN ('broker', 'both') THEN
    v_broker := public.get_broker_trust_profile(p_company_id);
  END IF;

  -- Shipper trust profile (if applicable)
  IF v_company.type IN ('shipper', 'both') THEN
    v_shipper := public.get_shipper_trust_profile(p_company_id);
  END IF;

  RETURN jsonb_build_object(
    'company_id', v_company.id,
    'company_name', v_company.name,
    'company_type', v_company.type,
    'platform_rating', v_company.rating,
    'total_loads', v_company.total_loads,
    'broker_profile', v_broker,
    'shipper_profile', v_shipper
  );
END;
$$;

COMMIT;
