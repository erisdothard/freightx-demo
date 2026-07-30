-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 071: Shipper Performance Scorecards (P1-07)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Aggregated carrier performance metrics per lane, visible to shippers.
-- 67% of shippers rank reliability as #1 priority.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Materialized view: carrier performance by lane ─────────────────────────
-- Refresh periodically via pg_cron or edge function
CREATE MATERIALIZED VIEW IF NOT EXISTS carrier_lane_performance AS
SELECT
  l.company_id AS shipper_company_id,
  b.company_id AS carrier_company_id,
  c.name       AS carrier_name,
  l.origin_state,
  l.dest_state,
  l.origin_state || ' → ' || l.dest_state AS lane,
  COUNT(*)     AS total_loads,
  COUNT(*) FILTER (WHERE l.status = 'completed') AS completed_loads,
  COUNT(*) FILTER (WHERE l.status = 'delivered' OR l.status = 'completed') AS delivered_loads,
  -- On-time: delivered by delivery_date
  ROUND(
    100.0 * COUNT(*) FILTER (
      WHERE (l.status = 'delivered' OR l.status = 'completed')
        AND l.delivery_date >= CURRENT_DATE - INTERVAL '365 days'
    ) / NULLIF(COUNT(*) FILTER (
      WHERE l.status IN ('delivered', 'completed')
    ), 0),
    1
  ) AS on_time_pct,
  -- Average transit time in days
  ROUND(
    AVG(
      EXTRACT(EPOCH FROM (
        COALESCE(
          (SELECT MIN(tm.created_at) FROM tracking_milestones tm
           WHERE tm.load_number = l.load_number AND tm.label ILIKE '%deliver%' AND tm.completed),
          l.delivery_date::timestamptz
        ) - l.pickup_date::timestamptz
      )) / 86400
    )::numeric,
    1
  ) AS avg_transit_days,
  -- Average rate per mile
  ROUND(AVG(l.rate_per_mile)::numeric, 2) AS avg_rate_per_mile,
  MAX(l.created_at) AS last_shipment_at
FROM loads l
JOIN bids b ON b.load_id = l.id AND b.status = 'accepted'
JOIN companies c ON c.id = b.company_id
WHERE l.status IN ('delivered', 'completed', 'in_transit')
  AND l.deleted_at IS NULL
  AND b.company_id IS NOT NULL
GROUP BY l.company_id, b.company_id, c.name, l.origin_state, l.dest_state
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_carrier_lane_perf_pk
  ON carrier_lane_performance(shipper_company_id, carrier_company_id, lane);

-- ── RPC: Get carrier scorecards for a shipper ──────────────────────────────
CREATE OR REPLACE FUNCTION public.get_carrier_scorecards(
  p_shipper_company_id uuid,
  p_lane text DEFAULT NULL
)
RETURNS TABLE (
  carrier_company_id uuid,
  carrier_name       text,
  lane               text,
  total_loads        bigint,
  completed_loads    bigint,
  on_time_pct        numeric,
  avg_transit_days   numeric,
  avg_rate_per_mile  numeric,
  last_shipment_at   timestamptz,
  reliability_grade  text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT
      clp.carrier_company_id,
      clp.carrier_name,
      clp.lane,
      clp.total_loads,
      clp.completed_loads,
      clp.on_time_pct,
      clp.avg_transit_days,
      clp.avg_rate_per_mile,
      clp.last_shipment_at,
      CASE
        WHEN clp.on_time_pct >= 95 AND clp.completed_loads >= 5 THEN 'A+'
        WHEN clp.on_time_pct >= 90 THEN 'A'
        WHEN clp.on_time_pct >= 80 THEN 'B'
        WHEN clp.on_time_pct >= 70 THEN 'C'
        ELSE 'D'
      END AS reliability_grade
    FROM public.carrier_lane_performance clp
    WHERE clp.shipper_company_id = p_shipper_company_id
      AND (p_lane IS NULL OR clp.lane = p_lane)
    ORDER BY clp.on_time_pct DESC NULLS LAST, clp.total_loads DESC;
END;
$$;

-- ── RPC: Refresh the materialized view ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.refresh_carrier_scorecards()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.carrier_lane_performance;
END;
$$;

COMMIT;
