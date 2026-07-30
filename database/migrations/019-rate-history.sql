-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 019: Lane Rate History + Intelligence (Phase 13C)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rate_history (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lane_hash      TEXT NOT NULL,         -- md5(origin_state||dest_state||equipment)
  origin_state   TEXT NOT NULL,
  dest_state     TEXT NOT NULL,
  equipment      TEXT NOT NULL,
  rate_usd       DECIMAL(10,2) NOT NULL,
  total_miles    INTEGER,
  rate_per_mile  DECIMAL(8,2),
  load_id        UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  recorded_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS rate_history_lane_idx      ON public.rate_history(lane_hash, recorded_at DESC);
CREATE INDEX IF NOT EXISTS rate_history_equipment_idx ON public.rate_history(equipment);
CREATE INDEX IF NOT EXISTS rate_history_recorded_idx  ON public.rate_history(recorded_at DESC);

ALTER TABLE public.rate_history ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can query rate history (market data)
CREATE POLICY "authenticated_view_rate_history" ON public.rate_history
  FOR SELECT USING (auth.role() = 'authenticated');

-- Service/app can insert (called on booking confirmed)
CREATE POLICY "authenticated_insert_rate_history" ON public.rate_history
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── RPC: get_lane_stats ──────────────────────────────────────────────────────
-- Returns avg rate/mile, count, and stddev for a lane over last N days.
CREATE OR REPLACE FUNCTION public.get_lane_stats(
  p_origin_state TEXT,
  p_dest_state   TEXT,
  p_equipment    TEXT,
  p_days         INT DEFAULT 90
)
RETURNS TABLE (
  avg_rate_per_mile  DECIMAL,
  min_rate_per_mile  DECIMAL,
  max_rate_per_mile  DECIMAL,
  sample_count       BIGINT,
  last_recorded_at   TIMESTAMPTZ
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    ROUND(AVG(rate_per_mile)::NUMERIC, 2),
    ROUND(MIN(rate_per_mile)::NUMERIC, 2),
    ROUND(MAX(rate_per_mile)::NUMERIC, 2),
    COUNT(*),
    MAX(recorded_at)
  FROM public.rate_history
  WHERE origin_state = p_origin_state
    AND dest_state   = p_dest_state
    AND equipment    = p_equipment
    AND rate_per_mile IS NOT NULL
    AND recorded_at  >= NOW() - (p_days || ' days')::INTERVAL;
$$;

-- ── RPC: get_lane_trend ──────────────────────────────────────────────────────
-- Returns daily avg rate/mile for sparkline charts (last 30 data points).
CREATE OR REPLACE FUNCTION public.get_lane_trend(
  p_origin_state TEXT,
  p_dest_state   TEXT,
  p_equipment    TEXT
)
RETURNS TABLE (
  day              DATE,
  avg_rate_per_mile DECIMAL
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    recorded_at::DATE AS day,
    ROUND(AVG(rate_per_mile)::NUMERIC, 2)
  FROM public.rate_history
  WHERE origin_state = p_origin_state
    AND dest_state   = p_dest_state
    AND equipment    = p_equipment
    AND rate_per_mile IS NOT NULL
    AND recorded_at  >= NOW() - INTERVAL '30 days'
  GROUP BY recorded_at::DATE
  ORDER BY day DESC
  LIMIT 30;
$$;
