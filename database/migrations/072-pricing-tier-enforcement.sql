-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 072: Pricing Tier Feature Enforcement (P1-02)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Defines what each tier can access and provides a feature-gate function
-- that the frontend calls before allowing access to gated features.
--
-- Tiers: free, carrier_pro ($49), broker_starter ($99), broker_growth ($199), enterprise
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Tier feature limits ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tier_feature_limits (
  tier              subscription_tier PRIMARY KEY,
  max_active_loads  integer,              -- NULL = unlimited
  max_saved_searches integer,
  load_alerts       boolean NOT NULL DEFAULT false,
  rate_analytics    boolean NOT NULL DEFAULT false,
  api_access        boolean NOT NULL DEFAULT false,
  priority_support  boolean NOT NULL DEFAULT false,
  white_label       boolean NOT NULL DEFAULT false,
  factoring_rate    numeric(4,2)          -- NULL = not available
);

INSERT INTO tier_feature_limits VALUES
  ('free',            5,   2,  false, false, false, false, false, NULL),
  ('carrier_pro',     NULL, 10, true,  true,  false, false, false, 2.50),
  ('broker_starter',  25,  5,  true,  false, false, false, false, NULL),
  ('broker_growth',   NULL, 25, true,  true,  true,  true,  false, 2.50),
  ('shipper',         15,  10, true,  false, false, false, false, NULL),
  ('enterprise',      NULL, NULL, true, true,  true,  true,  true, 1.50)
ON CONFLICT (tier) DO UPDATE SET
  max_active_loads   = EXCLUDED.max_active_loads,
  max_saved_searches = EXCLUDED.max_saved_searches,
  load_alerts        = EXCLUDED.load_alerts,
  rate_analytics     = EXCLUDED.rate_analytics,
  api_access         = EXCLUDED.api_access,
  priority_support   = EXCLUDED.priority_support,
  white_label        = EXCLUDED.white_label,
  factoring_rate     = EXCLUDED.factoring_rate;

ALTER TABLE tier_feature_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_limits" ON tier_feature_limits
  FOR SELECT USING (true);

-- ── RPC: Check if a company can use a feature ──────────────────────────────
CREATE OR REPLACE FUNCTION public.check_feature_access(
  p_company_id uuid,
  p_feature    text
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub    record;
  v_limits record;
  v_count  integer;
BEGIN
  -- Get company's subscription
  SELECT tier, status INTO v_sub
    FROM public.subscriptions
   WHERE company_id = p_company_id;

  -- Default to free tier if no subscription
  IF NOT FOUND THEN
    v_sub := ROW('free'::subscription_tier, 'active'::subscription_status);
  END IF;

  -- Inactive subscriptions fall back to free
  IF v_sub.status NOT IN ('active', 'trialing') THEN
    v_sub.tier := 'free';
  END IF;

  SELECT * INTO v_limits FROM public.tier_feature_limits WHERE tier = v_sub.tier;

  CASE p_feature
    WHEN 'post_load' THEN
      IF v_limits.max_active_loads IS NULL THEN
        RETURN jsonb_build_object('allowed', true, 'tier', v_sub.tier);
      END IF;
      SELECT COUNT(*) INTO v_count
        FROM public.loads
       WHERE company_id = p_company_id
         AND status IN ('posted', 'bid_received', 'awarded', 'dispatched', 'in_transit')
         AND deleted_at IS NULL;
      RETURN jsonb_build_object(
        'allowed', v_count < v_limits.max_active_loads,
        'tier', v_sub.tier,
        'current', v_count,
        'limit', v_limits.max_active_loads,
        'upgrade_reason', CASE WHEN v_count >= v_limits.max_active_loads
          THEN format('Free tier allows %s active loads. Upgrade to post more.', v_limits.max_active_loads)
          ELSE NULL END
      );

    WHEN 'saved_search' THEN
      IF v_limits.max_saved_searches IS NULL THEN
        RETURN jsonb_build_object('allowed', true, 'tier', v_sub.tier);
      END IF;
      SELECT COUNT(*) INTO v_count
        FROM public.saved_searches
       WHERE user_id = auth.uid();
      RETURN jsonb_build_object(
        'allowed', v_count < v_limits.max_saved_searches,
        'tier', v_sub.tier,
        'current', v_count,
        'limit', v_limits.max_saved_searches
      );

    WHEN 'load_alerts' THEN
      RETURN jsonb_build_object('allowed', v_limits.load_alerts, 'tier', v_sub.tier);

    WHEN 'rate_analytics' THEN
      RETURN jsonb_build_object('allowed', v_limits.rate_analytics, 'tier', v_sub.tier);

    WHEN 'api_access' THEN
      RETURN jsonb_build_object('allowed', v_limits.api_access, 'tier', v_sub.tier);

    WHEN 'factoring' THEN
      RETURN jsonb_build_object(
        'allowed', v_limits.factoring_rate IS NOT NULL,
        'tier', v_sub.tier,
        'rate', v_limits.factoring_rate
      );

    ELSE
      RETURN jsonb_build_object('allowed', true, 'tier', v_sub.tier);
  END CASE;
END;
$$;

-- ── RPC: Get full tier info for a company ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_company_tier(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_sub    record;
  v_limits record;
BEGIN
  SELECT tier, status, current_period_end, trial_ends_at
    INTO v_sub
    FROM public.subscriptions
   WHERE company_id = p_company_id;

  IF NOT FOUND THEN
    v_sub := ROW('free'::subscription_tier, 'active'::subscription_status, NULL::timestamptz, NULL::timestamptz);
  END IF;

  SELECT * INTO v_limits FROM public.tier_feature_limits
   WHERE tier = CASE WHEN v_sub.status IN ('active', 'trialing') THEN v_sub.tier ELSE 'free' END;

  RETURN jsonb_build_object(
    'tier', v_sub.tier,
    'status', v_sub.status,
    'period_end', v_sub.current_period_end,
    'trial_ends', v_sub.trial_ends_at,
    'limits', row_to_json(v_limits)
  );
END;
$$;

COMMIT;
