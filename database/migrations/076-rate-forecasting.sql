-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 076: Predictive Rate Forecasting (P2-04)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- DAT's $300/mo feature equivalent. Uses existing rate_history data to
-- compute moving averages, trend direction, and rate forecasts.
--
-- Gated behind rate_analytics feature flag (carrier_pro, broker_growth, enterprise).
--
-- New RPCs:
--   forecast_lane_rate() — trend + directional forecast with confidence
--   get_rate_heatmap()   — multi-lane rate comparison for equipment type
--   refresh_lane_benchmarks() — weekly benchmark snapshot builder
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── RPC: Forecast lane rate ──────────────────────────────────────────────────
-- Returns current avg, 7/14/30-day moving averages, trend direction,
-- and a naive linear forecast for the next 7 days.
CREATE OR REPLACE FUNCTION public.forecast_lane_rate(
  p_origin_state text,
  p_dest_state   text,
  p_equipment    text,
  p_lookback_days integer DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current     numeric;
  v_7d_avg      numeric;
  v_14d_avg     numeric;
  v_30d_avg     numeric;
  v_90d_avg     numeric;
  v_7d_count    bigint;
  v_30d_count   bigint;
  v_90d_count   bigint;
  v_stddev      numeric;
  v_slope       numeric;
  v_trend       text;
  v_forecast    numeric;
  v_confidence  text;
  v_weekly      jsonb;
BEGIN
  -- Current period averages
  SELECT
    ROUND(AVG(rate_per_mile) FILTER (WHERE recorded_at >= now() - interval '7 days')::numeric, 2),
    ROUND(AVG(rate_per_mile) FILTER (WHERE recorded_at >= now() - interval '14 days')::numeric, 2),
    ROUND(AVG(rate_per_mile) FILTER (WHERE recorded_at >= now() - interval '30 days')::numeric, 2),
    ROUND(AVG(rate_per_mile)::numeric, 2),
    COUNT(*) FILTER (WHERE recorded_at >= now() - interval '7 days'),
    COUNT(*) FILTER (WHERE recorded_at >= now() - interval '30 days'),
    COUNT(*),
    ROUND(STDDEV(rate_per_mile)::numeric, 2)
  INTO v_7d_avg, v_14d_avg, v_30d_avg, v_90d_avg,
       v_7d_count, v_30d_count, v_90d_count, v_stddev
  FROM public.rate_history
  WHERE origin_state = p_origin_state
    AND dest_state = p_dest_state
    AND equipment = p_equipment
    AND rate_per_mile IS NOT NULL
    AND recorded_at >= now() - (p_lookback_days || ' days')::interval;

  IF v_90d_count = 0 THEN
    RETURN jsonb_build_object(
      'has_data', false,
      'origin_state', p_origin_state,
      'dest_state', p_dest_state,
      'equipment', p_equipment
    );
  END IF;

  -- Use most recent period with data as "current"
  v_current := COALESCE(v_7d_avg, v_14d_avg, v_30d_avg, v_90d_avg);

  -- Linear trend: slope of weekly averages over lookback period
  -- Using weekly buckets for smoother trend line
  SELECT ROUND(regr_slope(weekly_avg, week_num)::numeric, 4)
  INTO v_slope
  FROM (
    SELECT
      AVG(rate_per_mile) AS weekly_avg,
      EXTRACT(EPOCH FROM date_trunc('week', recorded_at))::numeric / 604800 AS week_num
    FROM public.rate_history
    WHERE origin_state = p_origin_state
      AND dest_state = p_dest_state
      AND equipment = p_equipment
      AND rate_per_mile IS NOT NULL
      AND recorded_at >= now() - (p_lookback_days || ' days')::interval
    GROUP BY date_trunc('week', recorded_at)
    HAVING COUNT(*) >= 1
  ) weekly;

  -- Trend classification
  v_trend := CASE
    WHEN v_slope IS NULL THEN 'insufficient_data'
    WHEN v_slope > 0.05 THEN 'rising'
    WHEN v_slope > 0.02 THEN 'slightly_rising'
    WHEN v_slope < -0.05 THEN 'falling'
    WHEN v_slope < -0.02 THEN 'slightly_falling'
    ELSE 'stable'
  END;

  -- Naive linear forecast: current + slope * 1 week
  v_forecast := ROUND(COALESCE(v_current + COALESCE(v_slope, 0), v_current), 2);

  -- Confidence based on sample count + volatility
  v_confidence := CASE
    WHEN v_30d_count >= 20 AND v_stddev < 0.50 THEN 'high'
    WHEN v_30d_count >= 10 THEN 'medium'
    WHEN v_90d_count >= 5 THEN 'low'
    ELSE 'very_low'
  END;

  -- Weekly breakdown for chart
  SELECT jsonb_agg(
    jsonb_build_object(
      'week_start', week_start,
      'avg_rate', avg_rate,
      'min_rate', min_rate,
      'max_rate', max_rate,
      'sample_count', cnt
    ) ORDER BY week_start
  )
  INTO v_weekly
  FROM (
    SELECT
      date_trunc('week', recorded_at)::date AS week_start,
      ROUND(AVG(rate_per_mile)::numeric, 2) AS avg_rate,
      ROUND(MIN(rate_per_mile)::numeric, 2) AS min_rate,
      ROUND(MAX(rate_per_mile)::numeric, 2) AS max_rate,
      COUNT(*) AS cnt
    FROM public.rate_history
    WHERE origin_state = p_origin_state
      AND dest_state = p_dest_state
      AND equipment = p_equipment
      AND rate_per_mile IS NOT NULL
      AND recorded_at >= now() - (p_lookback_days || ' days')::interval
    GROUP BY date_trunc('week', recorded_at)
    ORDER BY week_start
  ) wk;

  RETURN jsonb_build_object(
    'has_data', true,
    'origin_state', p_origin_state,
    'dest_state', p_dest_state,
    'equipment', p_equipment,
    'current_rate', v_current,
    'moving_averages', jsonb_build_object(
      '7d', v_7d_avg,
      '14d', v_14d_avg,
      '30d', v_30d_avg,
      '90d', v_90d_avg
    ),
    'sample_counts', jsonb_build_object(
      '7d', v_7d_count,
      '30d', v_30d_count,
      '90d', v_90d_count
    ),
    'volatility', v_stddev,
    'trend', jsonb_build_object(
      'direction', v_trend,
      'slope_per_week', v_slope,
      'label', CASE v_trend
        WHEN 'rising' THEN 'Rates are rising'
        WHEN 'slightly_rising' THEN 'Rates trending up slightly'
        WHEN 'falling' THEN 'Rates are falling'
        WHEN 'slightly_falling' THEN 'Rates trending down slightly'
        WHEN 'stable' THEN 'Rates are stable'
        ELSE 'Not enough data for trend'
      END
    ),
    'forecast', jsonb_build_object(
      'next_week_est', v_forecast,
      'low_est', ROUND(v_forecast - COALESCE(v_stddev, 0), 2),
      'high_est', ROUND(v_forecast + COALESCE(v_stddev, 0), 2),
      'confidence', v_confidence
    ),
    'weekly_breakdown', COALESCE(v_weekly, '[]'::jsonb)
  );
END;
$$;

-- ── RPC: Rate heatmap — multi-lane comparison ────────────────────────────────
-- Returns rate stats for all lanes matching an equipment type, useful for
-- carriers deciding where to deadhead next.
CREATE OR REPLACE FUNCTION public.get_rate_heatmap(
  p_equipment    text,
  p_origin_state text DEFAULT NULL,
  p_days         integer DEFAULT 30,
  p_limit        integer DEFAULT 25
)
RETURNS TABLE (
  origin_state    text,
  dest_state      text,
  avg_rate_per_mile numeric,
  load_count      bigint,
  trend_direction text,
  last_seen       timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    WITH lane_stats AS (
      SELECT
        rh.origin_state,
        rh.dest_state,
        ROUND(AVG(rh.rate_per_mile)::numeric, 2) AS avg_rate_per_mile,
        COUNT(*) AS load_count,
        MAX(rh.recorded_at) AS last_seen,
        -- Simple trend: compare last 7d avg to prior 23d avg
        CASE
          WHEN AVG(rh.rate_per_mile) FILTER (WHERE rh.recorded_at >= now() - interval '7 days')
            > AVG(rh.rate_per_mile) FILTER (WHERE rh.recorded_at < now() - interval '7 days') * 1.02
          THEN 'rising'
          WHEN AVG(rh.rate_per_mile) FILTER (WHERE rh.recorded_at >= now() - interval '7 days')
            < AVG(rh.rate_per_mile) FILTER (WHERE rh.recorded_at < now() - interval '7 days') * 0.98
          THEN 'falling'
          ELSE 'stable'
        END AS trend_direction
      FROM public.rate_history rh
      WHERE rh.equipment = p_equipment
        AND rh.rate_per_mile IS NOT NULL
        AND rh.recorded_at >= now() - (p_days || ' days')::interval
        AND (p_origin_state IS NULL OR rh.origin_state = p_origin_state)
      GROUP BY rh.origin_state, rh.dest_state
      HAVING COUNT(*) >= 2
    )
    SELECT ls.origin_state, ls.dest_state, ls.avg_rate_per_mile,
           ls.load_count, ls.trend_direction, ls.last_seen
    FROM lane_stats ls
    ORDER BY ls.avg_rate_per_mile DESC
    LIMIT p_limit;
END;
$$;

-- ── RPC: Refresh lane benchmarks ─────────────────────────────────────────────
-- Snapshots the current week's rates into lane_benchmarks for historical tracking.
-- Call weekly via pg_cron or edge function.
CREATE OR REPLACE FUNCTION public.refresh_lane_benchmarks()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_week_start date;
  v_count      integer;
BEGIN
  v_week_start := date_trunc('week', CURRENT_DATE)::date;

  INSERT INTO public.lane_benchmarks (origin_state, dest_state, equipment, week_start,
    avg_rate_per_mile, min_rate_per_mile, max_rate_per_mile, sample_count)
  SELECT
    origin_state, dest_state, equipment, v_week_start,
    ROUND(AVG(rate_per_mile)::numeric, 3),
    ROUND(MIN(rate_per_mile)::numeric, 3),
    ROUND(MAX(rate_per_mile)::numeric, 3),
    COUNT(*)
  FROM public.rate_history
  WHERE rate_per_mile IS NOT NULL
    AND recorded_at >= v_week_start::timestamptz
    AND recorded_at < (v_week_start + interval '7 days')::timestamptz
  GROUP BY origin_state, dest_state, equipment
  ON CONFLICT (origin_state, dest_state, equipment, week_start) DO UPDATE SET
    avg_rate_per_mile = EXCLUDED.avg_rate_per_mile,
    min_rate_per_mile = EXCLUDED.min_rate_per_mile,
    max_rate_per_mile = EXCLUDED.max_rate_per_mile,
    sample_count = EXCLUDED.sample_count;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMIT;
