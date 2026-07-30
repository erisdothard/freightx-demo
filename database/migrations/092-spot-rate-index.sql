-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 092: Shipper Spot Rate Index (P4-06)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Data monetization. Real-time market intelligence that shippers pay for.
-- Aggregates FreightX transaction data into a lane-level spot rate index.
--
-- Tables:
--   spot_rate_snapshots — daily lane-level rate index values
--
-- RPCs:
--   compute_spot_rate_index() — generate daily index snapshot
--   get_spot_rate_index() — query current/historical index
--   get_shipper_rate_recommendation() — suggest posting rate
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Spot rate snapshots ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spot_rate_snapshots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date   date NOT NULL,
  origin_state    text NOT NULL,
  dest_state      text NOT NULL,
  equipment       text NOT NULL,

  -- Rate metrics
  avg_rate_per_mile     numeric(8,2) NOT NULL,
  median_rate_per_mile  numeric(8,2),
  p25_rate              numeric(8,2),           -- 25th percentile
  p75_rate              numeric(8,2),           -- 75th percentile
  min_rate              numeric(8,2),
  max_rate              numeric(8,2),
  stddev_rate           numeric(8,4),

  -- Volume metrics
  sample_count          integer NOT NULL,
  load_count            integer NOT NULL DEFAULT 0,   -- Posted loads this period
  fill_rate_pct         numeric(5,2),                 -- % of posted loads that got booked

  -- Trend
  day_over_day_pct      numeric(6,2),           -- % change from yesterday
  week_over_week_pct    numeric(6,2),           -- % change from 7 days ago
  trend_direction       text CHECK (trend_direction IN ('rising', 'falling', 'stable')),

  created_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (snapshot_date, origin_state, dest_state, equipment)
);

CREATE INDEX IF NOT EXISTS idx_spot_rate_lane ON spot_rate_snapshots(origin_state, dest_state, equipment);
CREATE INDEX IF NOT EXISTS idx_spot_rate_date ON spot_rate_snapshots(snapshot_date DESC);
-- BRIN for time-series queries
CREATE INDEX IF NOT EXISTS idx_spot_rate_brin ON spot_rate_snapshots USING brin(snapshot_date);

ALTER TABLE spot_rate_snapshots ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read (gated by tier in application layer)
CREATE POLICY "authenticated_read_spot_rates" ON spot_rate_snapshots
  FOR SELECT USING (auth.role() = 'authenticated');

-- System inserts only
CREATE POLICY "system_insert_spot_rates" ON spot_rate_snapshots
  FOR INSERT WITH CHECK (true);

-- ── RPC: Compute spot rate index ────────────────────────────────────────────
-- Designed to be called daily via pg_cron or edge function
CREATE OR REPLACE FUNCTION public.compute_spot_rate_index(
  p_snapshot_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lane        record;
  v_yesterday   record;
  v_last_week   record;
  v_inserted    integer := 0;
BEGIN
  FOR v_lane IN
    SELECT
      l.origin_state,
      l.dest_state,
      l.equipment,
      ROUND(AVG(l.rate_per_mile)::numeric, 2) AS avg_rpm,
      ROUND(percentile_cont(0.50) WITHIN GROUP (ORDER BY l.rate_per_mile)::numeric, 2) AS median_rpm,
      ROUND(percentile_cont(0.25) WITHIN GROUP (ORDER BY l.rate_per_mile)::numeric, 2) AS p25,
      ROUND(percentile_cont(0.75) WITHIN GROUP (ORDER BY l.rate_per_mile)::numeric, 2) AS p75,
      ROUND(MIN(l.rate_per_mile)::numeric, 2) AS min_rpm,
      ROUND(MAX(l.rate_per_mile)::numeric, 2) AS max_rpm,
      ROUND(stddev(l.rate_per_mile)::numeric, 4) AS stddev_rpm,
      COUNT(*)::integer AS sample_count,
      COUNT(*) FILTER (WHERE l.status IN ('booked', 'in_transit', 'completed', 'delivered'))::integer AS booked_count
    FROM public.loads l
    WHERE l.created_at >= (p_snapshot_date - interval '7 days')
      AND l.created_at < (p_snapshot_date + interval '1 day')
      AND l.rate_per_mile IS NOT NULL
      AND l.rate_per_mile > 0
      AND l.deleted_at IS NULL
    GROUP BY l.origin_state, l.dest_state, l.equipment
    HAVING COUNT(*) >= 3  -- Minimum sample size for statistical validity
  LOOP
    -- Get yesterday's rate for day-over-day
    SELECT avg_rate_per_mile INTO v_yesterday
      FROM public.spot_rate_snapshots
      WHERE origin_state = v_lane.origin_state
        AND dest_state = v_lane.dest_state
        AND equipment = v_lane.equipment
        AND snapshot_date = p_snapshot_date - 1;

    -- Get last week's rate for week-over-week
    SELECT avg_rate_per_mile INTO v_last_week
      FROM public.spot_rate_snapshots
      WHERE origin_state = v_lane.origin_state
        AND dest_state = v_lane.dest_state
        AND equipment = v_lane.equipment
        AND snapshot_date = p_snapshot_date - 7;

    INSERT INTO public.spot_rate_snapshots (
      snapshot_date, origin_state, dest_state, equipment,
      avg_rate_per_mile, median_rate_per_mile,
      p25_rate, p75_rate, min_rate, max_rate, stddev_rate,
      sample_count, load_count, fill_rate_pct,
      day_over_day_pct, week_over_week_pct, trend_direction
    ) VALUES (
      p_snapshot_date, v_lane.origin_state, v_lane.dest_state, v_lane.equipment,
      v_lane.avg_rpm, v_lane.median_rpm,
      v_lane.p25, v_lane.p75, v_lane.min_rpm, v_lane.max_rpm, v_lane.stddev_rpm,
      v_lane.sample_count, v_lane.sample_count,
      CASE WHEN v_lane.sample_count > 0
        THEN ROUND(v_lane.booked_count::numeric / v_lane.sample_count * 100, 1)
        ELSE NULL
      END,
      CASE WHEN v_yesterday.avg_rate_per_mile IS NOT NULL AND v_yesterday.avg_rate_per_mile > 0
        THEN ROUND((v_lane.avg_rpm - v_yesterday.avg_rate_per_mile) / v_yesterday.avg_rate_per_mile * 100, 2)
        ELSE NULL
      END,
      CASE WHEN v_last_week.avg_rate_per_mile IS NOT NULL AND v_last_week.avg_rate_per_mile > 0
        THEN ROUND((v_lane.avg_rpm - v_last_week.avg_rate_per_mile) / v_last_week.avg_rate_per_mile * 100, 2)
        ELSE NULL
      END,
      CASE
        WHEN v_last_week.avg_rate_per_mile IS NULL THEN 'stable'
        WHEN v_lane.avg_rpm > v_last_week.avg_rate_per_mile * 1.03 THEN 'rising'
        WHEN v_lane.avg_rpm < v_last_week.avg_rate_per_mile * 0.97 THEN 'falling'
        ELSE 'stable'
      END
    )
    ON CONFLICT (snapshot_date, origin_state, dest_state, equipment) DO UPDATE SET
      avg_rate_per_mile = EXCLUDED.avg_rate_per_mile,
      median_rate_per_mile = EXCLUDED.median_rate_per_mile,
      p25_rate = EXCLUDED.p25_rate,
      p75_rate = EXCLUDED.p75_rate,
      min_rate = EXCLUDED.min_rate,
      max_rate = EXCLUDED.max_rate,
      stddev_rate = EXCLUDED.stddev_rate,
      sample_count = EXCLUDED.sample_count,
      load_count = EXCLUDED.load_count,
      fill_rate_pct = EXCLUDED.fill_rate_pct,
      day_over_day_pct = EXCLUDED.day_over_day_pct,
      week_over_week_pct = EXCLUDED.week_over_week_pct,
      trend_direction = EXCLUDED.trend_direction;

    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'snapshot_date', p_snapshot_date,
    'lanes_indexed', v_inserted
  );
END;
$$;

-- ── RPC: Get spot rate index ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_spot_rate_index(
  p_origin_state   text,
  p_dest_state     text,
  p_equipment      text DEFAULT 'van',
  p_days           integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_current  record;
  v_history  jsonb;
BEGIN
  -- Latest snapshot
  SELECT * INTO v_current FROM public.spot_rate_snapshots
    WHERE origin_state = p_origin_state
      AND dest_state = p_dest_state
      AND equipment = p_equipment
    ORDER BY snapshot_date DESC LIMIT 1;

  -- Historical series
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', snapshot_date,
      'avg_rate', avg_rate_per_mile,
      'median_rate', median_rate_per_mile,
      'p25', p25_rate,
      'p75', p75_rate,
      'sample_count', sample_count,
      'fill_rate', fill_rate_pct,
      'trend', trend_direction
    ) ORDER BY snapshot_date
  ) INTO v_history
  FROM public.spot_rate_snapshots
  WHERE origin_state = p_origin_state
    AND dest_state = p_dest_state
    AND equipment = p_equipment
    AND snapshot_date >= CURRENT_DATE - p_days;

  IF v_current IS NULL THEN
    RETURN jsonb_build_object(
      'lane', p_origin_state || ' → ' || p_dest_state,
      'equipment', p_equipment,
      'data_available', false,
      'history', '[]'::jsonb
    );
  END IF;

  RETURN jsonb_build_object(
    'lane', p_origin_state || ' → ' || p_dest_state,
    'equipment', p_equipment,
    'data_available', true,
    'latest', jsonb_build_object(
      'date', v_current.snapshot_date,
      'avg_rate_per_mile', v_current.avg_rate_per_mile,
      'median_rate_per_mile', v_current.median_rate_per_mile,
      'p25', v_current.p25_rate,
      'p75', v_current.p75_rate,
      'sample_count', v_current.sample_count,
      'fill_rate_pct', v_current.fill_rate_pct,
      'day_over_day_pct', v_current.day_over_day_pct,
      'week_over_week_pct', v_current.week_over_week_pct,
      'trend', v_current.trend_direction
    ),
    'history', COALESCE(v_history, '[]'::jsonb)
  );
END;
$$;

-- ── RPC: Shipper rate recommendation ────────────────────────────────────────
-- Suggests a posting rate that balances carrier attraction with cost savings
CREATE OR REPLACE FUNCTION public.get_shipper_rate_recommendation(
  p_origin_state   text,
  p_dest_state     text,
  p_equipment      text DEFAULT 'van',
  p_urgency        text DEFAULT 'normal'  -- 'low', 'normal', 'urgent'
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_latest record;
  v_rec_rate numeric;
  v_percentile numeric;
  v_strategy text;
BEGIN
  SELECT * INTO v_latest FROM public.spot_rate_snapshots
    WHERE origin_state = p_origin_state
      AND dest_state = p_dest_state
      AND equipment = p_equipment
    ORDER BY snapshot_date DESC LIMIT 1;

  IF NOT FOUND THEN
    -- Fall back to lane_benchmarks
    SELECT avg_rate_per_mile INTO v_rec_rate
      FROM public.lane_benchmarks
      WHERE origin_state = p_origin_state
        AND dest_state = p_dest_state
        AND equipment = p_equipment
      ORDER BY week_start DESC LIMIT 1;

    IF v_rec_rate IS NULL THEN
      RETURN jsonb_build_object(
        'lane', p_origin_state || ' → ' || p_dest_state,
        'recommendation', 'Insufficient market data for this lane',
        'suggested_rate', NULL
      );
    END IF;

    RETURN jsonb_build_object(
      'lane', p_origin_state || ' → ' || p_dest_state,
      'suggested_rate_per_mile', v_rec_rate,
      'confidence', 'low',
      'source', 'lane_benchmarks'
    );
  END IF;

  -- Strategy based on urgency + market trend
  v_percentile := CASE p_urgency
    WHEN 'urgent' THEN 0.70   -- Pay above median to attract carriers fast
    WHEN 'normal' THEN 0.55   -- Slightly above median
    WHEN 'low'    THEN 0.40   -- Below median, wait for deals
    ELSE 0.55
  END;

  -- Adjust for trend
  IF v_latest.trend_direction = 'rising' THEN
    v_percentile := LEAST(v_percentile + 0.10, 0.85);
    v_strategy := 'Market rates are rising. Posting at a premium to secure capacity.';
  ELSIF v_latest.trend_direction = 'falling' THEN
    v_percentile := GREATEST(v_percentile - 0.10, 0.25);
    v_strategy := 'Market rates are falling. Posting conservatively to capture savings.';
  ELSE
    v_strategy := 'Market is stable. Posting at a competitive rate.';
  END IF;

  -- Interpolate rate at target percentile
  v_rec_rate := ROUND(
    v_latest.p25_rate + (v_latest.p75_rate - v_latest.p25_rate) * v_percentile,
    2
  );

  RETURN jsonb_build_object(
    'lane', p_origin_state || ' → ' || p_dest_state,
    'equipment', p_equipment,
    'urgency', p_urgency,
    'suggested_rate_per_mile', v_rec_rate,
    'market_avg', v_latest.avg_rate_per_mile,
    'market_median', v_latest.median_rate_per_mile,
    'market_range', jsonb_build_object(
      'p25', v_latest.p25_rate,
      'p75', v_latest.p75_rate
    ),
    'fill_rate_pct', v_latest.fill_rate_pct,
    'trend', v_latest.trend_direction,
    'strategy', v_strategy,
    'confidence', CASE
      WHEN v_latest.sample_count >= 20 THEN 'high'
      WHEN v_latest.sample_count >= 10 THEN 'medium'
      ELSE 'low'
    END
  );
END;
$$;

COMMIT;
