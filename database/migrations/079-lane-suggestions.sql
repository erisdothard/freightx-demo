-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 079: LaneMakers — Proactive Lane Suggestions (P2-07)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Carrier engagement feature. Suggests lanes to carriers based on their
-- bid/booking history, equipment type, and current location (home state).
-- Increases platform stickiness by proactively showing relevant opportunities.
--
-- New table:
--   carrier_lane_preferences — explicit lane preferences set by carriers
--
-- New RPCs:
--   get_lane_suggestions(carrier_company_id) — AI-powered lane recommendations
--   get_backhaul_opportunities(origin_state, equipment) — deadhead reducers
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Carrier lane preferences ─────────────────────────────────────────────────
-- Carriers can explicitly mark lanes they're interested in
CREATE TABLE IF NOT EXISTS carrier_lane_preferences (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier_company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  origin_state        text NOT NULL,
  dest_state          text NOT NULL,
  equipment           text,
  min_rate_per_mile   numeric(6,2),
  max_deadhead_miles  integer,
  active              boolean NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (carrier_company_id, origin_state, dest_state, equipment)
);

CREATE INDEX IF NOT EXISTS idx_lane_prefs_carrier ON carrier_lane_preferences(carrier_company_id);
CREATE INDEX IF NOT EXISTS idx_lane_prefs_lane ON carrier_lane_preferences(origin_state, dest_state);

ALTER TABLE carrier_lane_preferences ENABLE ROW LEVEL SECURITY;

-- Carrier company members can manage their lane preferences
CREATE POLICY "carrier_manage_lane_prefs" ON carrier_lane_preferences
  FOR ALL USING (
    carrier_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    carrier_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- ── RPC: Get lane suggestions for a carrier ──────────────────────────────────
-- Combines: explicit preferences, bid history, booking history, and
-- high-volume lanes matching their equipment.
CREATE OR REPLACE FUNCTION public.get_lane_suggestions(
  p_carrier_company_id uuid,
  p_limit integer DEFAULT 15
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_equipment  text;
  v_home_state text;
  v_suggestions jsonb;
BEGIN
  -- Infer carrier's primary equipment from their trucks
  SELECT equipment INTO v_equipment
  FROM public.trucks
  WHERE company_id = p_carrier_company_id
  GROUP BY equipment
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  -- Infer home state from company address or most frequent origin
  SELECT COALESCE(
    (SELECT state FROM public.companies WHERE id = p_carrier_company_id),
    (SELECT origin_state FROM public.loads l
     JOIN public.bids b ON b.load_id = l.id
     WHERE b.company_id = p_carrier_company_id AND b.status = 'accepted'
     GROUP BY origin_state ORDER BY COUNT(*) DESC LIMIT 1)
  ) INTO v_home_state;

  SELECT jsonb_agg(suggestion ORDER BY priority DESC, avg_rate DESC)
  INTO v_suggestions
  FROM (
    -- 1. Lanes from explicit preferences with matching active loads
    SELECT
      'preference' AS source,
      lp.origin_state,
      lp.dest_state,
      COALESCE(lp.equipment, v_equipment) AS equipment,
      ROUND(AVG(rh.rate_per_mile)::numeric, 2) AS avg_rate,
      COUNT(DISTINCT l.id) AS active_loads,
      3 AS priority
    FROM public.carrier_lane_preferences lp
    LEFT JOIN public.rate_history rh
      ON rh.origin_state = lp.origin_state
      AND rh.dest_state = lp.dest_state
      AND (lp.equipment IS NULL OR rh.equipment = lp.equipment)
      AND rh.recorded_at >= now() - interval '90 days'
    LEFT JOIN public.loads l
      ON l.origin_state = lp.origin_state
      AND l.dest_state = lp.dest_state
      AND l.status = 'posted'
      AND l.deleted_at IS NULL
      AND (lp.equipment IS NULL OR l.equipment = lp.equipment)
    WHERE lp.carrier_company_id = p_carrier_company_id
      AND lp.active = true
    GROUP BY lp.origin_state, lp.dest_state, lp.equipment

    UNION ALL

    -- 2. Lanes carrier has historically worked (bid accepted)
    SELECT
      'history' AS source,
      l.origin_state,
      l.dest_state,
      l.equipment,
      ROUND(AVG(l.rate_per_mile)::numeric, 2) AS avg_rate,
      (SELECT COUNT(*) FROM public.loads l2
       WHERE l2.origin_state = l.origin_state
         AND l2.dest_state = l.dest_state
         AND l2.equipment = l.equipment
         AND l2.status = 'posted'
         AND l2.deleted_at IS NULL) AS active_loads,
      2 AS priority
    FROM public.loads l
    JOIN public.bids b ON b.load_id = l.id
    WHERE b.company_id = p_carrier_company_id
      AND b.status = 'accepted'
      AND l.rate_per_mile IS NOT NULL
    GROUP BY l.origin_state, l.dest_state, l.equipment

    UNION ALL

    -- 3. High-demand lanes matching equipment from home state
    SELECT
      'recommended' AS source,
      pl.origin_state,
      pl.dest_state,
      pl.equipment,
      ROUND(pl.avg_rate_per_mile::numeric, 2) AS avg_rate,
      pl.load_count AS active_loads,
      1 AS priority
    FROM public.popular_lanes pl
    WHERE (v_equipment IS NULL OR pl.equipment = v_equipment)
      AND (v_home_state IS NULL OR pl.origin_state = v_home_state)
      AND pl.load_count >= 3
    LIMIT 5
  ) suggestions
  LIMIT p_limit;

  RETURN jsonb_build_object(
    'carrier_company_id', p_carrier_company_id,
    'inferred_equipment', v_equipment,
    'home_state', v_home_state,
    'suggestions', COALESCE(v_suggestions, '[]'::jsonb)
  );
END;
$$;

-- ── RPC: Backhaul opportunities ──────────────────────────────────────────────
-- After delivering a load, show carriers loads heading back toward home
-- or to another high-value destination.
CREATE OR REPLACE FUNCTION public.get_backhaul_opportunities(
  p_current_state text,
  p_equipment     text,
  p_limit         integer DEFAULT 10
)
RETURNS TABLE (
  load_id         uuid,
  load_number     text,
  origin          text,
  destination     text,
  rate_usd        numeric,
  rate_per_mile   numeric,
  total_miles     integer,
  pickup_date     date,
  delivery_date   date,
  posted_at       timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT
      l.id,
      l.load_number,
      l.origin_city || ', ' || l.origin_state AS origin,
      l.dest_city || ', ' || l.dest_state AS destination,
      l.rate_usd,
      l.rate_per_mile,
      l.total_miles,
      l.pickup_date,
      l.delivery_date,
      l.posted_at
    FROM public.loads l
    WHERE l.origin_state = p_current_state
      AND l.equipment = p_equipment
      AND l.status = 'posted'
      AND l.deleted_at IS NULL
      AND l.pickup_date >= CURRENT_DATE
      AND (l.visibility = 'public' OR l.visibility IS NULL)
    ORDER BY l.rate_per_mile DESC NULLS LAST, l.pickup_date ASC
    LIMIT p_limit;
END;
$$;

COMMIT;
