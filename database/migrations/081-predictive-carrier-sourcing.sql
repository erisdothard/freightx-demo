-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 081: Predictive Carrier Sourcing AI (P3-01)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Beats DAT's Convoy Platform. Scores carriers on how likely they are to
-- accept a specific load, based on:
--   - Lane history (bid acceptance rate on this lane)
--   - Equipment match (fleet has the right truck type)
--   - Rate competitiveness (load rate vs carrier's min threshold)
--   - Saved search alignment (carrier actively watching this lane)
--   - Fleet availability (trucks marked available for pickup date)
--   - Relationship status (preferred/blocked)
--   - Performance (on-time %, reliability grade)
--
-- New RPCs:
--   score_carrier_for_load() — single carrier score
--   rank_carriers_for_load() — top N ranked carriers
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── RPC: Score a single carrier for a specific load ──────────────────────────
CREATE OR REPLACE FUNCTION public.score_carrier_for_load(
  p_load_id          uuid,
  p_carrier_company_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_load           record;
  v_score          numeric := 0;
  v_max_score      numeric := 0;
  v_factors        jsonb := '[]'::jsonb;
  v_eligible       boolean;
  v_lane_pref      record;
  v_lane_perf      record;
  v_fleet_match    integer;
  v_fleet_avail    integer;
  v_search_match   boolean := false;
  v_bid_history    record;
  v_rel_status     text;
  v_company_rating numeric;
BEGIN
  -- Get load details
  SELECT * INTO v_load FROM public.loads WHERE id = p_load_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Load not found');
  END IF;

  -- Gate: carrier must be eligible (verified + insured)
  SELECT public.check_carrier_eligible(p_carrier_company_id) INTO v_eligible;
  IF NOT v_eligible THEN
    RETURN jsonb_build_object(
      'carrier_company_id', p_carrier_company_id,
      'score', 0, 'max_score', 100, 'pct', 0,
      'eligible', false,
      'reason', 'Carrier not eligible (unverified or uninsured)'
    );
  END IF;

  -- Check relationship status (blocked = exclude)
  SELECT cr.status INTO v_rel_status
    FROM public.carrier_relationships cr
   WHERE cr.company_id = v_load.company_id
     AND cr.carrier_id IN (
       SELECT user_id FROM public.company_members
       WHERE company_id = p_carrier_company_id AND role = 'owner'
     );

  IF v_rel_status = 'blocked' THEN
    RETURN jsonb_build_object(
      'carrier_company_id', p_carrier_company_id,
      'score', 0, 'max_score', 100, 'pct', 0,
      'eligible', false,
      'reason', 'Carrier is blocked by this shipper/broker'
    );
  END IF;

  -- ── Factor 1: Equipment match (25 pts) ──────────────────────────
  v_max_score := v_max_score + 25;
  SELECT COUNT(*) INTO v_fleet_match
    FROM public.trucks
   WHERE company_id = p_carrier_company_id
     AND equipment = v_load.equipment;

  IF v_fleet_match > 0 THEN
    v_score := v_score + 25;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'equipment_match', 'points', 25, 'max', 25,
      'detail', format('%s matching trucks in fleet', v_fleet_match));
  ELSE
    v_factors := v_factors || jsonb_build_object(
      'factor', 'equipment_match', 'points', 0, 'max', 25,
      'detail', 'No matching equipment in fleet');
  END IF;

  -- ── Factor 2: Fleet availability (15 pts) ───────────────────────
  v_max_score := v_max_score + 15;
  SELECT COUNT(*) INTO v_fleet_avail
    FROM public.trucks
   WHERE company_id = p_carrier_company_id
     AND equipment = v_load.equipment
     AND status = 'available';

  IF v_fleet_avail > 0 THEN
    v_score := v_score + 15;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'fleet_available', 'points', 15, 'max', 15,
      'detail', format('%s available trucks', v_fleet_avail));
  ELSE
    v_factors := v_factors || jsonb_build_object(
      'factor', 'fleet_available', 'points', 0, 'max', 15,
      'detail', 'No available trucks');
  END IF;

  -- ── Factor 3: Lane preference match (20 pts) ───────────────────
  v_max_score := v_max_score + 20;
  SELECT * INTO v_lane_pref
    FROM public.carrier_lane_preferences
   WHERE carrier_company_id = p_carrier_company_id
     AND origin_state = v_load.origin_state
     AND dest_state = v_load.dest_state
     AND active = true
   LIMIT 1;

  IF FOUND THEN
    -- Check rate threshold
    IF v_lane_pref.min_rate_per_mile IS NOT NULL
       AND v_load.rate_per_mile < v_lane_pref.min_rate_per_mile THEN
      v_score := v_score + 5;  -- Partial: lane match but rate too low
      v_factors := v_factors || jsonb_build_object(
        'factor', 'lane_preference', 'points', 5, 'max', 20,
        'detail', format('Lane preferred but rate ($%s/mi) below threshold ($%s/mi)',
          v_load.rate_per_mile, v_lane_pref.min_rate_per_mile));
    ELSE
      v_score := v_score + 20;
      v_factors := v_factors || jsonb_build_object(
        'factor', 'lane_preference', 'points', 20, 'max', 20,
        'detail', 'Carrier has explicit preference for this lane');
    END IF;
  ELSE
    v_factors := v_factors || jsonb_build_object(
      'factor', 'lane_preference', 'points', 0, 'max', 20,
      'detail', 'No explicit lane preference set');
  END IF;

  -- ── Factor 4: Historical lane performance (15 pts) ──────────────
  v_max_score := v_max_score + 15;
  SELECT
    total_loads, on_time_pct
  INTO v_lane_perf
  FROM public.carrier_lane_performance
  WHERE carrier_company_id = p_carrier_company_id
    AND origin_state = v_load.origin_state
    AND dest_state = v_load.dest_state
  LIMIT 1;

  IF FOUND AND v_lane_perf.total_loads > 0 THEN
    v_score := v_score + LEAST(15, ROUND(v_lane_perf.total_loads * 3));
    v_factors := v_factors || jsonb_build_object(
      'factor', 'lane_history', 'points', LEAST(15, ROUND(v_lane_perf.total_loads * 3)),
      'max', 15,
      'detail', format('%s previous loads on this lane, %s%% on-time',
        v_lane_perf.total_loads, COALESCE(v_lane_perf.on_time_pct, 0)));
  ELSE
    v_factors := v_factors || jsonb_build_object(
      'factor', 'lane_history', 'points', 0, 'max', 15,
      'detail', 'No history on this lane');
  END IF;

  -- ── Factor 5: Active saved search match (10 pts) ────────────────
  v_max_score := v_max_score + 10;
  SELECT EXISTS (
    SELECT 1 FROM public.saved_searches ss
    JOIN public.company_members cm ON cm.user_id = ss.user_id
    WHERE cm.company_id = p_carrier_company_id
      AND ss.alert_enabled = true
      AND (ss.filters->>'equipment' IS NULL
           OR ss.filters->>'equipment' = 'all'
           OR ss.filters->>'equipment' = v_load.equipment)
      AND (ss.filters->>'origin_state' IS NULL
           OR ss.filters->>'origin_state' = v_load.origin_state)
      AND (ss.filters->>'dest_state' IS NULL
           OR ss.filters->>'dest_state' = v_load.dest_state)
  ) INTO v_search_match;

  IF v_search_match THEN
    v_score := v_score + 10;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'saved_search', 'points', 10, 'max', 10,
      'detail', 'Carrier has active alert matching this load');
  ELSE
    v_factors := v_factors || jsonb_build_object(
      'factor', 'saved_search', 'points', 0, 'max', 10,
      'detail', 'No matching saved search');
  END IF;

  -- ── Factor 6: Carrier rating (10 pts) ───────────────────────────
  v_max_score := v_max_score + 10;
  SELECT rating INTO v_company_rating
    FROM public.companies WHERE id = p_carrier_company_id;

  IF v_company_rating IS NOT NULL THEN
    v_score := v_score + ROUND(v_company_rating * 2);  -- 5-star → 10 pts
    v_factors := v_factors || jsonb_build_object(
      'factor', 'carrier_rating', 'points', ROUND(v_company_rating * 2),
      'max', 10,
      'detail', format('Platform rating: %s/5', v_company_rating));
  ELSE
    v_score := v_score + 5;  -- Neutral for unrated
    v_factors := v_factors || jsonb_build_object(
      'factor', 'carrier_rating', 'points', 5, 'max', 10,
      'detail', 'No rating yet (neutral score)');
  END IF;

  -- ── Factor 7: Preferred carrier bonus (5 pts) ───────────────────
  v_max_score := v_max_score + 5;
  IF v_rel_status = 'preferred' THEN
    v_score := v_score + 5;
    v_factors := v_factors || jsonb_build_object(
      'factor', 'preferred_status', 'points', 5, 'max', 5,
      'detail', 'Carrier is on preferred list');
  ELSE
    v_factors := v_factors || jsonb_build_object(
      'factor', 'preferred_status', 'points', 0, 'max', 5,
      'detail', 'Not on preferred list');
  END IF;

  RETURN jsonb_build_object(
    'carrier_company_id', p_carrier_company_id,
    'load_id', p_load_id,
    'eligible', true,
    'score', v_score,
    'max_score', v_max_score,
    'pct', ROUND(100.0 * v_score / v_max_score),
    'grade', CASE
      WHEN v_score >= v_max_score * 0.85 THEN 'A+'
      WHEN v_score >= v_max_score * 0.70 THEN 'A'
      WHEN v_score >= v_max_score * 0.55 THEN 'B'
      WHEN v_score >= v_max_score * 0.40 THEN 'C'
      ELSE 'D'
    END,
    'factors', v_factors
  );
END;
$$;

-- ── RPC: Rank top carriers for a load ────────────────────────────────────────
-- Returns sorted list of best-fit carriers with scores
CREATE OR REPLACE FUNCTION public.rank_carriers_for_load(
  p_load_id uuid,
  p_limit   integer DEFAULT 20
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_load      record;
  v_carrier   record;
  v_result    jsonb;
  v_rankings  jsonb := '[]'::jsonb;
  v_count     integer := 0;
BEGIN
  SELECT * INTO v_load FROM public.loads WHERE id = p_load_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Load not found');
  END IF;

  -- Score all carriers that have matching equipment
  FOR v_carrier IN
    SELECT DISTINCT t.company_id, c.name AS company_name
    FROM public.trucks t
    JOIN public.companies c ON c.id = t.company_id
    WHERE t.equipment = v_load.equipment
      AND c.type IN ('carrier', 'both')
      AND c.id != v_load.company_id  -- Exclude the poster's company
    ORDER BY c.name
    LIMIT 100  -- Cap for performance
  LOOP
    v_result := public.score_carrier_for_load(p_load_id, v_carrier.company_id);

    IF (v_result->>'eligible')::boolean AND (v_result->>'pct')::integer > 0 THEN
      v_rankings := v_rankings || jsonb_build_object(
        'carrier_company_id', v_carrier.company_id,
        'company_name', v_carrier.company_name,
        'score', (v_result->>'score')::integer,
        'max_score', (v_result->>'max_score')::integer,
        'pct', (v_result->>'pct')::integer,
        'grade', v_result->>'grade',
        'factors', v_result->'factors'
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  -- Sort by score descending
  SELECT jsonb_agg(elem ORDER BY (elem->>'pct')::integer DESC)
  INTO v_rankings
  FROM jsonb_array_elements(v_rankings) AS elem;

  -- Trim to limit
  IF v_rankings IS NOT NULL AND jsonb_array_length(v_rankings) > p_limit THEN
    SELECT jsonb_agg(elem)
    INTO v_rankings
    FROM (
      SELECT elem FROM jsonb_array_elements(v_rankings) AS elem
      LIMIT p_limit
    ) top;
  END IF;

  RETURN jsonb_build_object(
    'load_id', p_load_id,
    'load_number', v_load.load_number,
    'lane', v_load.origin_state || ' → ' || v_load.dest_state,
    'equipment', v_load.equipment,
    'total_scored', v_count,
    'rankings', COALESCE(v_rankings, '[]'::jsonb)
  );
END;
$$;

COMMIT;
