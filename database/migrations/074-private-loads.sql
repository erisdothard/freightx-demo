-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 074: Private / Invite-Only Loads (P2-02)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Truckstop July 2025 feature equivalent. Brokers/shippers can restrict load
-- visibility to invited carriers or their preferred list.
--
-- Visibility levels:
--   public           — visible to all authenticated users (default)
--   preferred_only   — only preferred carriers (existing carrier_relationships)
--   invited_only     — only explicitly invited carriers
--
-- This migration:
--   1. Adds visibility enum + column to loads
--   2. Creates load_invitations table
--   3. Replaces the blanket loads SELECT policy with visibility-aware RLS
--   4. Creates invite_carriers_to_load() RPC
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Visibility enum ──────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE load_visibility AS ENUM ('public', 'preferred_only', 'invited_only');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE loads ADD COLUMN IF NOT EXISTS visibility load_visibility NOT NULL DEFAULT 'public';

-- Migrate existing preferred_carriers_only flag
UPDATE loads SET visibility = 'preferred_only' WHERE preferred_carriers_only = true;

-- ── Load invitations table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS load_invitations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  load_id           uuid NOT NULL REFERENCES loads(id) ON DELETE CASCADE,
  carrier_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  invited_by        uuid NOT NULL REFERENCES profiles(id),
  status            text NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'viewed', 'bid_placed', 'declined', 'expired')),
  message           text CHECK (char_length(message) <= 500),
  expires_at        timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (load_id, carrier_company_id)
);

CREATE INDEX IF NOT EXISTS idx_load_invitations_load ON load_invitations(load_id);
CREATE INDEX IF NOT EXISTS idx_load_invitations_carrier ON load_invitations(carrier_company_id);
CREATE INDEX IF NOT EXISTS idx_load_invitations_pending
  ON load_invitations(carrier_company_id) WHERE status = 'pending';

ALTER TABLE load_invitations ENABLE ROW LEVEL SECURITY;

-- Poster and their company can manage invitations
CREATE POLICY "poster_manage_invitations" ON load_invitations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM loads WHERE id = load_invitations.load_id
        AND (posted_by = auth.uid() OR company_id IN (
          SELECT company_id FROM company_members
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        ))
    )
  );

-- Invited carriers can view and update their own invitations
CREATE POLICY "carrier_view_invitations" ON load_invitations
  FOR SELECT USING (
    carrier_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "carrier_respond_invitations" ON load_invitations
  FOR UPDATE USING (
    carrier_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Carriers can only change status (not reassign to different load/company)
    carrier_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- ── Replace loads SELECT policy with visibility-aware version ────────────────
-- Drop the existing blanket policy
DROP POLICY IF EXISTS "loads_select_all" ON loads;
DROP POLICY IF EXISTS "Authenticated users can view loads" ON loads;
DROP POLICY IF EXISTS "authenticated_view_loads" ON loads;

-- New visibility-aware SELECT policy
CREATE POLICY "loads_visibility_select" ON loads
  FOR SELECT USING (
    -- Always see your own loads
    posted_by = auth.uid()
    OR company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
    -- Admins see everything
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
    -- Assigned drivers see their loads
    OR assigned_driver_id = auth.uid()
    OR second_driver_id = auth.uid()
    -- Carriers with accepted bids see the load
    OR EXISTS (
      SELECT 1 FROM bids WHERE load_id = loads.id
        AND status = 'accepted'
        AND company_id IN (
          SELECT company_id FROM company_members WHERE user_id = auth.uid()
        )
    )
    -- Visibility rules for other users
    OR (
      deleted_at IS NULL
      AND status NOT IN ('cancelled')
      AND (
        -- Public loads: everyone
        visibility = 'public'
        -- Preferred-only: carrier in poster's preferred list
        OR (visibility = 'preferred_only' AND EXISTS (
          SELECT 1 FROM carrier_relationships cr
          WHERE cr.company_id = loads.company_id
            AND cr.carrier_id = auth.uid()
            AND cr.status = 'preferred'
        ))
        -- Invited-only: carrier has active invitation
        OR (visibility = 'invited_only' AND EXISTS (
          SELECT 1 FROM load_invitations li
          WHERE li.load_id = loads.id
            AND li.carrier_company_id IN (
              SELECT company_id FROM company_members WHERE user_id = auth.uid()
            )
            AND li.status != 'expired'
            AND (li.expires_at IS NULL OR li.expires_at > now())
        ))
      )
    )
  );

-- ── RPC: Invite carriers to a load ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.invite_carriers_to_load(
  p_load_id          uuid,
  p_carrier_company_ids uuid[],
  p_message          text DEFAULT NULL,
  p_expires_in_hours integer DEFAULT 72
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_load       record;
  v_carrier_id uuid;
  v_count      integer := 0;
  v_expires    timestamptz;
BEGIN
  -- Verify load exists and caller owns it
  SELECT id, load_number, company_id, posted_by, visibility
    INTO v_load FROM public.loads WHERE id = p_load_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load not found';
  END IF;

  IF v_load.posted_by != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = v_load.company_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only the load poster or company admin can invite carriers';
  END IF;

  v_expires := CASE
    WHEN p_expires_in_hours IS NOT NULL THEN now() + (p_expires_in_hours || ' hours')::interval
    ELSE NULL
  END;

  FOREACH v_carrier_id IN ARRAY p_carrier_company_ids
  LOOP
    INSERT INTO public.load_invitations (load_id, carrier_company_id, invited_by, message, expires_at)
    VALUES (p_load_id, v_carrier_id, auth.uid(), p_message, v_expires)
    ON CONFLICT (load_id, carrier_company_id) DO NOTHING;

    -- Notify carrier company owner
    INSERT INTO public.notifications (user_id, type, title, body, load_id, read)
    SELECT cm.user_id, 'new_load', 'Private Load Invitation',
           format('You''ve been invited to bid on load %s.', v_load.load_number),
           p_load_id, false
    FROM public.company_members cm
    WHERE cm.company_id = v_carrier_id AND cm.role IN ('owner', 'admin');

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ── RPC: Get my load invitations ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_load_invitations(
  p_status text DEFAULT 'pending'
)
RETURNS TABLE (
  invitation_id  uuid,
  load_id        uuid,
  load_number    text,
  origin         text,
  destination    text,
  equipment      text,
  rate_usd       numeric,
  message        text,
  expires_at     timestamptz,
  invited_at     timestamptz,
  broker_name    text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
    SELECT
      li.id AS invitation_id,
      li.load_id,
      l.load_number,
      l.origin_city || ', ' || l.origin_state AS origin,
      l.dest_city || ', ' || l.dest_state AS destination,
      l.equipment,
      l.rate_usd,
      li.message,
      li.expires_at,
      li.created_at AS invited_at,
      c.name AS broker_name
    FROM public.load_invitations li
    JOIN public.loads l ON l.id = li.load_id
    JOIN public.companies c ON c.id = l.company_id
    WHERE li.carrier_company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
    AND (p_status IS NULL OR li.status = p_status)
    AND (li.expires_at IS NULL OR li.expires_at > now())
    AND l.deleted_at IS NULL
    AND l.status NOT IN ('cancelled', 'completed', 'delivered')
    ORDER BY li.created_at DESC;
END;
$$;

-- ── Auto-expire invitations ──────────────────────────────────────────────────
-- Mark expired invitations (call via pg_cron or edge function periodically)
CREATE OR REPLACE FUNCTION public.expire_load_invitations()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.load_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMIT;
