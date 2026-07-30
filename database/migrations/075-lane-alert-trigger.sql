-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 075: Lane Alert Trigger + Saved Search Limits (P2-03)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Wires the existing lane-alert edge function to load INSERT events.
-- The edge function checks all saved searches with alert_enabled = true,
-- matches filters, and sends in-app + email notifications.
--
-- Also adds:
--   - Saved search count enforcement via check_feature_access
--   - enforce_saved_search_limit() trigger
--   - SQL-native lane matching as fallback (no edge function dependency)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Trigger: Fire lane-alert edge function on load INSERT ────────────────────
-- Uses pg_net for async HTTP POST (non-blocking)
CREATE OR REPLACE FUNCTION public.on_load_posted_lane_alert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Only fire for new loads in posted status (not drafts)
  IF NEW.status NOT IN ('posted') THEN
    RETURN NEW;
  END IF;

  -- Fire-and-forget to lane-alert edge function
  PERFORM net.http_post(
    url    := current_setting('app.settings.supabase_url', true)
              || '/functions/v1/lane-alert',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body   := jsonb_build_object(
      'load', jsonb_build_object(
        'id', NEW.id,
        'load_number', NEW.load_number,
        'origin_city', NEW.origin_city,
        'origin_state', NEW.origin_state,
        'dest_city', NEW.dest_city,
        'dest_state', NEW.dest_state,
        'equipment', NEW.equipment,
        'rate_usd', NEW.rate_usd,
        'rate_per_mile', NEW.rate_per_mile,
        'total_miles', NEW.total_miles,
        'hazmat', NEW.hazmat,
        'temp_controlled', NEW.temp_controlled
      )
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lane_alert_on_load ON loads;
CREATE TRIGGER trg_lane_alert_on_load
  AFTER INSERT ON loads
  FOR EACH ROW
  EXECUTE FUNCTION on_load_posted_lane_alert();

-- ── SQL-native lane matching (fallback / direct call) ────────────────────────
-- For environments without pg_net or edge functions, this RPC does the
-- matching and notification in pure SQL.
CREATE OR REPLACE FUNCTION public.match_lane_alerts(p_load_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_load    record;
  v_search  record;
  v_count   integer := 0;
  v_filters jsonb;
BEGIN
  SELECT * INTO v_load FROM public.loads WHERE id = p_load_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR v_search IN
    SELECT ss.*, p.id AS profile_id
    FROM public.saved_searches ss
    JOIN public.profiles p ON p.id = ss.user_id
    WHERE ss.alert_enabled = true
      AND ss.user_id != v_load.posted_by  -- Don't alert the poster
  LOOP
    v_filters := v_search.filters;

    -- Check equipment
    IF v_filters->>'equipment' IS NOT NULL
       AND v_filters->>'equipment' != 'all'
       AND v_filters->>'equipment' != v_load.equipment THEN
      CONTINUE;
    END IF;

    -- Check origin state
    IF v_filters->>'origin_state' IS NOT NULL
       AND v_filters->>'origin_state' != v_load.origin_state THEN
      CONTINUE;
    END IF;

    -- Check dest state
    IF v_filters->>'dest_state' IS NOT NULL
       AND v_filters->>'dest_state' != v_load.dest_state THEN
      CONTINUE;
    END IF;

    -- Check min rate per mile
    IF (v_filters->>'min_rate_per_mile')::numeric IS NOT NULL
       AND v_load.rate_per_mile < (v_filters->>'min_rate_per_mile')::numeric THEN
      CONTINUE;
    END IF;

    -- Match! Insert notification
    INSERT INTO public.notifications (user_id, type, title, body, load_id, read)
    VALUES (
      v_search.user_id,
      'lane_alert',
      format('Lane Alert: %s, %s → %s, %s',
        v_load.origin_city, v_load.origin_state,
        v_load.dest_city, v_load.dest_state),
      format('New %s load matching "%s" — $%s',
        v_load.equipment, v_search.name,
        COALESCE(v_load.rate_usd::text, 'Call')),
      v_load.id,
      false
    );

    -- Update last_alerted_at
    UPDATE public.saved_searches
    SET last_alerted_at = now()
    WHERE id = v_search.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── Enforce saved search limits by tier ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_saved_search_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_access     jsonb;
  v_current    integer;
BEGIN
  -- Get user's company
  SELECT company_id INTO v_company_id
    FROM public.company_members
   WHERE user_id = NEW.user_id
   LIMIT 1;

  IF v_company_id IS NULL THEN
    -- No company = free tier, use default limit
    SELECT COUNT(*) INTO v_current
      FROM public.saved_searches WHERE user_id = NEW.user_id;

    IF v_current >= 2 THEN
      RAISE EXCEPTION 'Free tier allows 2 saved searches. Upgrade to save more.';
    END IF;
    RETURN NEW;
  END IF;

  -- Check via feature access
  v_access := public.check_feature_access(v_company_id, 'saved_search');

  IF NOT (v_access->>'allowed')::boolean THEN
    RAISE EXCEPTION '%', COALESCE(
      v_access->>'upgrade_reason',
      'Saved search limit reached. Upgrade your plan.'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_saved_search_limit ON saved_searches;
CREATE TRIGGER trg_enforce_saved_search_limit
  BEFORE INSERT ON saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION enforce_saved_search_limit();

-- ── Enforce alert_enabled behind load_alerts feature ─────────────────────────
-- Free tier users can save searches but can't enable alerts
CREATE OR REPLACE FUNCTION public.enforce_alert_tier()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_company_id uuid;
  v_access     jsonb;
BEGIN
  -- Only check when enabling alerts
  IF NEW.alert_enabled = false OR OLD.alert_enabled = true THEN
    RETURN NEW;
  END IF;

  SELECT company_id INTO v_company_id
    FROM public.company_members
   WHERE user_id = NEW.user_id
   LIMIT 1;

  IF v_company_id IS NOT NULL THEN
    v_access := public.check_feature_access(v_company_id, 'load_alerts');
    IF NOT (v_access->>'allowed')::boolean THEN
      RAISE EXCEPTION 'Load alerts require Carrier Pro or higher. Upgrade to enable alerts.';
    END IF;
  ELSE
    -- No company = free tier, alerts not available
    RAISE EXCEPTION 'Load alerts require Carrier Pro or higher. Upgrade to enable alerts.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_alert_tier ON saved_searches;
CREATE TRIGGER trg_enforce_alert_tier
  BEFORE UPDATE ON saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION enforce_alert_tier();

-- Also enforce on INSERT when alert_enabled defaults to true
DROP TRIGGER IF EXISTS trg_enforce_alert_tier_insert ON saved_searches;
CREATE TRIGGER trg_enforce_alert_tier_insert
  BEFORE INSERT ON saved_searches
  FOR EACH ROW
  WHEN (NEW.alert_enabled = true)
  EXECUTE FUNCTION enforce_alert_tier();

COMMIT;
