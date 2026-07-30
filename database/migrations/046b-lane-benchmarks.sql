-- Phase 16: Lane Intelligence Platform
-- Materialized view for top 50 lanes by volume (refreshed daily via pg_cron)
-- and a weekly aggregate cache table for faster lane lookups.

-- Popular lanes materialized view
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_lanes AS
SELECT
  origin_state,
  dest_state,
  equipment,
  COUNT(*)                              AS load_count,
  AVG(rate_per_mile)                   AS avg_rate_per_mile,
  MIN(rate_per_mile)                   AS min_rate_per_mile,
  MAX(rate_per_mile)                   AS max_rate_per_mile,
  MAX(recorded_at)                     AS last_seen_at
FROM rate_history
WHERE recorded_at > NOW() - INTERVAL '90 days'
  AND rate_per_mile IS NOT NULL
GROUP BY origin_state, dest_state, equipment
ORDER BY load_count DESC
LIMIT 50;

CREATE UNIQUE INDEX IF NOT EXISTS popular_lanes_lane_idx
  ON popular_lanes (origin_state, dest_state, equipment);

-- Refresh popular_lanes daily at 2 AM UTC (requires pg_cron extension)
SELECT cron.schedule(
  'refresh-popular-lanes',
  '0 2 * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY popular_lanes;$$
) WHERE EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron');

-- Weekly aggregate cache for faster repeated lookups
CREATE TABLE IF NOT EXISTS lane_benchmarks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  origin_state    TEXT NOT NULL,
  dest_state      TEXT NOT NULL,
  equipment       TEXT NOT NULL,
  week_start      DATE NOT NULL,
  avg_rate_per_mile NUMERIC(6, 3),
  min_rate_per_mile NUMERIC(6, 3),
  max_rate_per_mile NUMERIC(6, 3),
  sample_count    INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (origin_state, dest_state, equipment, week_start)
);

ALTER TABLE lane_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lane_benchmarks_read_authenticated"
  ON lane_benchmarks FOR SELECT
  TO authenticated
  USING (true);

-- Grant read access to popular_lanes for authenticated users
GRANT SELECT ON popular_lanes TO authenticated;
