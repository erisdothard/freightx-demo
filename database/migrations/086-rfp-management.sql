-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 086: RFP Management — Contract Freight (P3-06)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Contract freight market. Shippers create RFPs for recurring lanes,
-- carriers submit proposals, shippers award contracts.
--
-- Tables:
--   rfps — request for proposal definitions
--   rfp_lanes — individual lanes within an RFP
--   rfp_proposals — carrier bids on RFP lanes
--   rfp_awards — awarded contracts
--
-- RPCs:
--   submit_rfp_proposal() — carrier submits proposal
--   award_rfp_lane() — shipper awards lane to carrier
--   get_rfp_summary() — aggregated RFP status
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── RFPs ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfps (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  created_by        uuid NOT NULL REFERENCES profiles(id),
  title             text NOT NULL,
  description       text,
  contract_start    date NOT NULL,
  contract_end      date NOT NULL,
  volume_estimate   text,             -- e.g., '50-100 loads/month'
  equipment         text,
  requirements      jsonb DEFAULT '{}'::jsonb,  -- Special requirements
  status            text NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published', 'closed',
                                        'awarded', 'cancelled')),
  published_at      timestamptz,
  closes_at         timestamptz,      -- Deadline for proposals
  visibility        text NOT NULL DEFAULT 'public'
                      CHECK (visibility IN ('public', 'invited_only')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CHECK (contract_end > contract_start)
);

CREATE INDEX IF NOT EXISTS idx_rfps_company ON rfps(company_id);
CREATE INDEX IF NOT EXISTS idx_rfps_status ON rfps(status) WHERE status = 'published';

ALTER TABLE rfps ENABLE ROW LEVEL SECURITY;

-- Owner manages their RFPs
CREATE POLICY "company_manage_rfps" ON rfps
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Published RFPs visible to all authenticated users
CREATE POLICY "authenticated_view_published_rfps" ON rfps
  FOR SELECT USING (
    status = 'published' AND visibility = 'public'
  );

-- ── RFP lanes ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfp_lanes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id            uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  origin_city       text,
  origin_state      text NOT NULL,
  dest_city         text,
  dest_state        text NOT NULL,
  equipment         text,
  loads_per_week    integer,
  target_rate_usd   numeric(10,2),    -- Shipper's target rate (optional)
  special_requirements text,
  status            text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'awarded', 'no_award')),
  awarded_to        uuid REFERENCES companies(id),
  awarded_rate      numeric(10,2),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfp_lanes_rfp ON rfp_lanes(rfp_id);

ALTER TABLE rfp_lanes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rfp_lanes_follow_rfp" ON rfp_lanes
  FOR ALL USING (
    rfp_id IN (SELECT id FROM rfps)  -- Inherits RFP visibility
  );

-- ── RFP proposals ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rfp_proposals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfp_id            uuid NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
  rfp_lane_id       uuid NOT NULL REFERENCES rfp_lanes(id) ON DELETE CASCADE,
  carrier_company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  submitted_by      uuid NOT NULL REFERENCES profiles(id),
  proposed_rate_usd numeric(10,2) NOT NULL,
  capacity_per_week integer,
  transit_days      integer,
  equipment_offered text,
  notes             text CHECK (char_length(notes) <= 1000),
  status            text NOT NULL DEFAULT 'submitted'
                      CHECK (status IN ('submitted', 'shortlisted', 'awarded',
                                        'declined', 'withdrawn')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  UNIQUE (rfp_lane_id, carrier_company_id)
);

CREATE INDEX IF NOT EXISTS idx_rfp_proposals_rfp ON rfp_proposals(rfp_id);
CREATE INDEX IF NOT EXISTS idx_rfp_proposals_lane ON rfp_proposals(rfp_lane_id);
CREATE INDEX IF NOT EXISTS idx_rfp_proposals_carrier ON rfp_proposals(carrier_company_id);

ALTER TABLE rfp_proposals ENABLE ROW LEVEL SECURITY;

-- Carriers manage their own proposals
CREATE POLICY "carrier_manage_proposals" ON rfp_proposals
  FOR ALL USING (
    carrier_company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- RFP owner can view all proposals on their RFPs
CREATE POLICY "rfp_owner_view_proposals" ON rfp_proposals
  FOR SELECT USING (
    rfp_id IN (
      SELECT id FROM rfps WHERE company_id IN (
        SELECT company_id FROM company_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    )
  );

-- ── RPC: Submit RFP proposal ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_rfp_proposal(
  p_rfp_lane_id       uuid,
  p_proposed_rate_usd  numeric,
  p_capacity_per_week  integer DEFAULT NULL,
  p_transit_days       integer DEFAULT NULL,
  p_equipment_offered  text DEFAULT NULL,
  p_notes              text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lane       record;
  v_rfp        record;
  v_carrier_co uuid;
  v_proposal_id uuid;
BEGIN
  -- Get lane and RFP
  SELECT rl.*, r.status AS rfp_status, r.closes_at, r.id AS rfp_id_val
    INTO v_lane
    FROM public.rfp_lanes rl
    JOIN public.rfps r ON r.id = rl.rfp_id
   WHERE rl.id = p_rfp_lane_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'RFP lane not found');
  END IF;

  IF v_lane.rfp_status != 'published' THEN
    RETURN jsonb_build_object('success', false, 'error', 'RFP is not accepting proposals');
  END IF;

  IF v_lane.closes_at IS NOT NULL AND v_lane.closes_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'RFP submission deadline has passed');
  END IF;

  -- Get carrier company
  SELECT company_id INTO v_carrier_co
    FROM public.company_members WHERE user_id = auth.uid() LIMIT 1;

  IF v_carrier_co IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not associated with a carrier company');
  END IF;

  INSERT INTO public.rfp_proposals (
    rfp_id, rfp_lane_id, carrier_company_id, submitted_by,
    proposed_rate_usd, capacity_per_week, transit_days,
    equipment_offered, notes
  ) VALUES (
    v_lane.rfp_id_val, p_rfp_lane_id, v_carrier_co, auth.uid(),
    p_proposed_rate_usd, p_capacity_per_week, p_transit_days,
    p_equipment_offered, p_notes
  )
  ON CONFLICT (rfp_lane_id, carrier_company_id) DO UPDATE SET
    proposed_rate_usd = EXCLUDED.proposed_rate_usd,
    capacity_per_week = EXCLUDED.capacity_per_week,
    transit_days = EXCLUDED.transit_days,
    equipment_offered = EXCLUDED.equipment_offered,
    notes = EXCLUDED.notes,
    updated_at = now()
  RETURNING id INTO v_proposal_id;

  RETURN jsonb_build_object(
    'success', true,
    'proposal_id', v_proposal_id,
    'lane', v_lane.origin_state || ' → ' || v_lane.dest_state,
    'proposed_rate', p_proposed_rate_usd
  );
END;
$$;

-- ── RPC: Award RFP lane ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.award_rfp_lane(
  p_rfp_lane_id      uuid,
  p_carrier_company_id uuid,
  p_awarded_rate      numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_lane record;
  v_rfp  record;
BEGIN
  SELECT rl.*, r.company_id AS rfp_company_id
    INTO v_lane
    FROM public.rfp_lanes rl
    JOIN public.rfps r ON r.id = rl.rfp_id
   WHERE rl.id = p_rfp_lane_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lane not found');
  END IF;

  -- Verify caller owns the RFP
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = v_lane.rfp_company_id
      AND user_id = auth.uid() AND role IN ('owner', 'admin')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only the RFP owner can award lanes');
  END IF;

  -- Award the lane
  UPDATE public.rfp_lanes
  SET status = 'awarded',
      awarded_to = p_carrier_company_id,
      awarded_rate = p_awarded_rate
  WHERE id = p_rfp_lane_id;

  -- Update the winning proposal
  UPDATE public.rfp_proposals
  SET status = 'awarded'
  WHERE rfp_lane_id = p_rfp_lane_id
    AND carrier_company_id = p_carrier_company_id;

  -- Decline other proposals
  UPDATE public.rfp_proposals
  SET status = 'declined'
  WHERE rfp_lane_id = p_rfp_lane_id
    AND carrier_company_id != p_carrier_company_id
    AND status = 'submitted';

  -- Notify the winning carrier
  INSERT INTO public.notifications (user_id, type, title, body, read)
  SELECT cm.user_id, 'system', 'RFP Lane Awarded',
         format('You''ve been awarded the %s → %s lane at $%s/load.',
           v_lane.origin_state, v_lane.dest_state, p_awarded_rate),
         false
  FROM public.company_members cm
  WHERE cm.company_id = p_carrier_company_id
    AND cm.role IN ('owner', 'admin');

  RETURN jsonb_build_object(
    'success', true,
    'lane', v_lane.origin_state || ' → ' || v_lane.dest_state,
    'awarded_to', p_carrier_company_id,
    'rate', p_awarded_rate
  );
END;
$$;

-- ── RPC: Get RFP summary ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_rfp_summary(p_rfp_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_rfp   record;
  v_lanes jsonb;
BEGIN
  SELECT * INTO v_rfp FROM public.rfps WHERE id = p_rfp_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'RFP not found');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'lane_id', rl.id,
      'lane', COALESCE(rl.origin_city || ', ', '') || rl.origin_state || ' → ' ||
              COALESCE(rl.dest_city || ', ', '') || rl.dest_state,
      'equipment', rl.equipment,
      'loads_per_week', rl.loads_per_week,
      'target_rate', rl.target_rate_usd,
      'status', rl.status,
      'proposal_count', (SELECT COUNT(*) FROM public.rfp_proposals WHERE rfp_lane_id = rl.id),
      'awarded_to', rl.awarded_to,
      'awarded_rate', rl.awarded_rate
    )
  ) INTO v_lanes
  FROM public.rfp_lanes rl
  WHERE rl.rfp_id = p_rfp_id;

  RETURN jsonb_build_object(
    'rfp_id', v_rfp.id,
    'title', v_rfp.title,
    'status', v_rfp.status,
    'contract_start', v_rfp.contract_start,
    'contract_end', v_rfp.contract_end,
    'closes_at', v_rfp.closes_at,
    'lanes', COALESCE(v_lanes, '[]'::jsonb),
    'total_lanes', (SELECT COUNT(*) FROM public.rfp_lanes WHERE rfp_id = p_rfp_id),
    'awarded_lanes', (SELECT COUNT(*) FROM public.rfp_lanes WHERE rfp_id = p_rfp_id AND status = 'awarded'),
    'total_proposals', (SELECT COUNT(*) FROM public.rfp_proposals WHERE rfp_id = p_rfp_id)
  );
END;
$$;

COMMIT;
