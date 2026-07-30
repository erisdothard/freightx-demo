-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 022: Full-Text Search Optimization (Phase 13D)
-- Run in Supabase Dashboard → SQL Editor
-- Target: all load searches < 50ms at 100k rows
-- ─────────────────────────────────────────────────────────────────────────────

-- ── GIN indexes on loads text columns ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS loads_origin_city_gin    ON public.loads USING gin(to_tsvector('english', origin_city));
CREATE INDEX IF NOT EXISTS loads_dest_city_gin      ON public.loads USING gin(to_tsvector('english', dest_city));
CREATE INDEX IF NOT EXISTS loads_commodity_gin      ON public.loads USING gin(to_tsvector('english', COALESCE(commodity, '')));
CREATE INDEX IF NOT EXISTS loads_company_name_gin   ON public.loads USING gin(to_tsvector('english', COALESCE(company_name, '')));

-- ── Standard B-tree indexes for filter columns ────────────────────────────────
CREATE INDEX IF NOT EXISTS loads_origin_state_idx   ON public.loads(origin_state);
CREATE INDEX IF NOT EXISTS loads_dest_state_idx     ON public.loads(dest_state);
CREATE INDEX IF NOT EXISTS loads_equipment_idx      ON public.loads(equipment);
CREATE INDEX IF NOT EXISTS loads_status_idx         ON public.loads(status);
CREATE INDEX IF NOT EXISTS loads_rate_per_mile_idx  ON public.loads(rate_per_mile);
CREATE INDEX IF NOT EXISTS loads_pickup_date_idx    ON public.loads(pickup_date);
CREATE INDEX IF NOT EXISTS loads_posted_at_idx      ON public.loads(posted_at DESC);

-- ── search_vector generated column ───────────────────────────────────────────
-- Combines all searchable text into one tsvector for ultra-fast search.
ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS search_vector TSVECTOR
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(load_number,  '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(origin_city,  '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(dest_city,    '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(commodity,    '')), 'C') ||
    setweight(to_tsvector('english', COALESCE(company_name, '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS loads_search_vector_gin ON public.loads USING gin(search_vector);

-- ── Full-text search RPC ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.search_loads(
  p_query        TEXT,
  p_equipment    TEXT DEFAULT NULL,
  p_origin_state TEXT DEFAULT NULL,
  p_dest_state   TEXT DEFAULT NULL,
  p_status       TEXT DEFAULT NULL,
  p_page         INT  DEFAULT 0,
  p_page_size    INT  DEFAULT 25
)
RETURNS TABLE (
  id              UUID,
  load_number     TEXT,
  origin_city     TEXT,
  origin_state    TEXT,
  dest_city       TEXT,
  dest_state      TEXT,
  equipment       TEXT,
  status          TEXT,
  rate_usd        NUMERIC,
  rate_per_mile   NUMERIC,
  total_miles     INT,
  commodity       TEXT,
  pickup_date     TEXT,
  company_name    TEXT,
  bid_count       INT,
  posted_at       TIMESTAMPTZ,
  rank            FLOAT4
) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    l.id, l.load_number, l.origin_city, l.origin_state,
    l.dest_city, l.dest_state, l.equipment, l.status,
    l.rate_usd, l.rate_per_mile, l.total_miles, l.commodity,
    l.pickup_date, l.company_name, l.bid_count, l.posted_at,
    ts_rank(l.search_vector, websearch_to_tsquery('english', p_query)) AS rank
  FROM public.loads l
  WHERE
    (p_query IS NULL OR p_query = '' OR l.search_vector @@ websearch_to_tsquery('english', p_query))
    AND (p_equipment    IS NULL OR l.equipment    = p_equipment)
    AND (p_origin_state IS NULL OR l.origin_state = p_origin_state)
    AND (p_dest_state   IS NULL OR l.dest_state   = p_dest_state)
    AND (p_status       IS NULL OR l.status       = p_status)
  ORDER BY
    CASE WHEN p_query IS NULL OR p_query = '' THEN NULL
         ELSE ts_rank(l.search_vector, websearch_to_tsquery('english', p_query))
    END DESC NULLS LAST,
    l.posted_at DESC
  LIMIT p_page_size
  OFFSET (p_page * p_page_size);
$$;
