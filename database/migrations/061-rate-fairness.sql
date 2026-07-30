-- Migration 061: Rate Fairness — percentile ranking against lane history
-- Shows carriers exactly where a load's rate falls in the market distribution.

CREATE OR REPLACE FUNCTION public.get_rate_fairness(p_load_id uuid)
RETURNS TABLE (
  rate_per_mile    DECIMAL,
  market_avg       DECIMAL,
  market_min       DECIMAL,
  market_max       DECIMAL,
  percentile       INT,
  sample_count     BIGINT,
  fairness_label   TEXT,
  confidence       TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_load           record;
  v_pct            DECIMAL;
  v_count          BIGINT;
  v_avg            DECIMAL;
  v_min            DECIMAL;
  v_max            DECIMAL;
BEGIN
  -- Fetch load details
  SELECT l.origin_state, l.dest_state, l.equipment,
         CASE WHEN l.total_miles > 0
              THEN ROUND((l.rate_usd / l.total_miles)::NUMERIC, 2)
              ELSE NULL
         END AS rpm
    INTO v_load
    FROM loads l
   WHERE l.id = p_load_id;

  IF NOT FOUND OR v_load.rpm IS NULL THEN
    RETURN;
  END IF;

  -- Aggregate lane stats (90-day window)
  SELECT COUNT(*),
         ROUND(AVG(rh.rate_per_mile)::NUMERIC, 2),
         ROUND(MIN(rh.rate_per_mile)::NUMERIC, 2),
         ROUND(MAX(rh.rate_per_mile)::NUMERIC, 2)
    INTO v_count, v_avg, v_min, v_max
    FROM rate_history rh
   WHERE rh.origin_state = v_load.origin_state
     AND rh.dest_state   = v_load.dest_state
     AND rh.equipment    = v_load.equipment
     AND rh.rate_per_mile IS NOT NULL
     AND rh.recorded_at >= NOW() - INTERVAL '90 days';

  IF v_count = 0 THEN
    RETURN;
  END IF;

  -- Compute percentile rank (what % of historical rates is this load above)
  SELECT ROUND(
           (COUNT(*) FILTER (WHERE rh.rate_per_mile <= v_load.rpm)::DECIMAL / v_count) * 100
         )::INT
    INTO v_pct
    FROM rate_history rh
   WHERE rh.origin_state = v_load.origin_state
     AND rh.dest_state   = v_load.dest_state
     AND rh.equipment    = v_load.equipment
     AND rh.rate_per_mile IS NOT NULL
     AND rh.recorded_at >= NOW() - INTERVAL '90 days';

  RETURN QUERY SELECT
    v_load.rpm,
    v_avg,
    v_min,
    v_max,
    v_pct,
    v_count,
    CASE
      WHEN v_pct >= 75 THEN 'Excellent'
      WHEN v_pct >= 50 THEN 'Above Average'
      WHEN v_pct >= 25 THEN 'Fair'
      ELSE                   'Below Market'
    END,
    CASE
      WHEN v_count >= 20 THEN 'high'
      WHEN v_count >= 5  THEN 'medium'
      ELSE                    'low'
    END;
END;
$$;
