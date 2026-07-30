-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 078: Factoring / Instant Pay Enhancement (P2-06)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Primary revenue engine. Carriers sell delivered-load invoices for immediate
-- payment minus a tier-based fee (2.5% standard, 1.5% enterprise).
--
-- Builds on existing factoring_requests table (migration 047b):
--   - Tier-aware fee rates from tier_feature_limits.factoring_rate
--   - Eligibility validation (load delivered, carrier verified, not already factored)
--   - request_factoring() RPC for secure workflow
--   - approve_factoring() admin RPC
--   - Factoring dashboard stats RPC
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Add payment tracking columns ─────────────────────────────────────────────
ALTER TABLE factoring_requests ADD COLUMN IF NOT EXISTS payment_method text
  CHECK (payment_method IS NULL OR payment_method IN ('ach', 'wire', 'check'));
ALTER TABLE factoring_requests ADD COLUMN IF NOT EXISTS payment_reference text;
ALTER TABLE factoring_requests ADD COLUMN IF NOT EXISTS broker_company_id uuid REFERENCES companies(id);

-- ── RPC: Request factoring on a delivered load ───────────────────────────────
CREATE OR REPLACE FUNCTION public.request_factoring(
  p_load_id        uuid,
  p_payment_method text DEFAULT 'ach'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_load           record;
  v_bid            record;
  v_carrier_co     uuid;
  v_fee_rate       numeric;
  v_invoice_amount numeric;
  v_access         jsonb;
  v_request_id     uuid;
BEGIN
  -- Get the load
  SELECT id, load_number, status, company_id, rate_usd
    INTO v_load FROM public.loads WHERE id = p_load_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Load not found');
  END IF;

  -- Load must be delivered or completed
  IF v_load.status NOT IN ('delivered', 'completed') THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Factoring only available for delivered loads');
  END IF;

  -- Get carrier's accepted bid
  SELECT b.company_id, b.amount INTO v_bid
    FROM public.bids b
   WHERE b.load_id = p_load_id
     AND b.status = 'accepted'
     AND b.company_id IN (
       SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
     );

  IF v_bid.company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Only the carrier who completed this load can request factoring');
  END IF;

  v_carrier_co := v_bid.company_id;
  v_invoice_amount := COALESCE(v_bid.amount, v_load.rate_usd);

  -- Check if already factored
  IF EXISTS (
    SELECT 1 FROM public.factoring_requests
    WHERE load_id = p_load_id AND status NOT IN ('denied', 'cancelled')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error',
      'This load already has an active factoring request');
  END IF;

  -- Check tier access
  v_access := public.check_feature_access(v_carrier_co, 'factoring');
  IF NOT (v_access->>'allowed')::boolean THEN
    RETURN jsonb_build_object('success', false, 'error',
      'Factoring not available on your current plan. Upgrade to Carrier Pro or higher.');
  END IF;

  -- Get tier-specific fee rate
  v_fee_rate := COALESCE((v_access->>'rate')::numeric, 2.50);

  -- Create the request
  INSERT INTO public.factoring_requests (
    carrier_id, company_id, load_id, load_number,
    invoice_amount, fee_percent, broker_company_id,
    payment_method, status
  ) VALUES (
    auth.uid(), v_carrier_co, p_load_id, v_load.load_number,
    v_invoice_amount, v_fee_rate, v_load.company_id,
    p_payment_method, 'requested'
  )
  RETURNING id INTO v_request_id;

  -- Notify admin
  INSERT INTO public.notifications (user_id, type, title, body, load_id, read)
  SELECT p.id, 'system', 'New Factoring Request',
         format('Carrier requested factoring on load %s — $%s at %s%% fee.',
           v_load.load_number, v_invoice_amount, v_fee_rate),
         p_load_id, false
  FROM public.profiles p WHERE p.role = 'admin';

  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'invoice_amount', v_invoice_amount,
    'fee_percent', v_fee_rate,
    'net_payout', ROUND(v_invoice_amount - (v_invoice_amount * v_fee_rate / 100), 2)
  );
END;
$$;

-- ── RPC: Approve factoring (admin only) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_factoring(
  p_request_id      uuid,
  p_payment_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request record;
  v_caller  record;
BEGIN
  SELECT role INTO v_caller FROM public.profiles WHERE id = auth.uid();
  IF v_caller.role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT * INTO v_request FROM public.factoring_requests WHERE id = p_request_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;

  IF v_request.status != 'requested' THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Cannot approve request in %s status', v_request.status));
  END IF;

  UPDATE public.factoring_requests
  SET status = 'approved',
      approved_at = now(),
      payment_reference = p_payment_reference
  WHERE id = p_request_id;

  -- Notify carrier
  INSERT INTO public.notifications (user_id, type, title, body, load_id, read)
  VALUES (
    v_request.carrier_id, 'payment_received',
    'Factoring Approved',
    format('Your factoring request for load %s has been approved. Net payout: $%s.',
      v_request.load_number, v_request.net_payout),
    v_request.load_id, false
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'approved',
    'net_payout', v_request.net_payout
  );
END;
$$;

-- ── RPC: Fund factoring (mark as paid) ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fund_factoring(
  p_request_id       uuid,
  p_payment_reference text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request record;
BEGIN
  SELECT role INTO STRICT v_request FROM public.profiles WHERE id = auth.uid();
  IF v_request.role != 'admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  UPDATE public.factoring_requests
  SET status = 'funded',
      funded_at = now(),
      payment_reference = p_payment_reference
  WHERE id = p_request_id AND status = 'approved'
  RETURNING * INTO v_request;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or not in approved status');
  END IF;

  -- Notify carrier of funding
  INSERT INTO public.notifications (user_id, type, title, body, load_id, read)
  VALUES (
    v_request.carrier_id, 'payment_received',
    'Instant Pay Sent',
    format('$%s has been sent for load %s via %s. Reference: %s',
      v_request.net_payout, v_request.load_number,
      COALESCE(v_request.payment_method, 'ACH'), p_payment_reference),
    v_request.load_id, false
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', 'funded',
    'net_payout', v_request.net_payout,
    'payment_reference', p_payment_reference
  );
END;
$$;

-- ── RPC: Factoring dashboard stats ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_factoring_stats(p_company_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stats record;
BEGIN
  SELECT
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE status = 'funded') AS funded_count,
    COUNT(*) FILTER (WHERE status = 'requested') AS pending_count,
    COALESCE(SUM(invoice_amount) FILTER (WHERE status = 'funded'), 0) AS total_factored,
    COALESCE(SUM(invoice_amount * fee_percent / 100) FILTER (WHERE status = 'funded'), 0) AS total_fees_earned,
    COALESCE(SUM(net_payout) FILTER (WHERE status = 'funded'), 0) AS total_paid_out,
    COALESCE(AVG(fee_percent) FILTER (WHERE status = 'funded'), 0) AS avg_fee_rate
  INTO v_stats
  FROM public.factoring_requests
  WHERE (p_company_id IS NULL OR company_id = p_company_id);

  RETURN jsonb_build_object(
    'total_requests', v_stats.total_requests,
    'funded_count', v_stats.funded_count,
    'pending_count', v_stats.pending_count,
    'total_factored', ROUND(v_stats.total_factored, 2),
    'total_fees_earned', ROUND(v_stats.total_fees_earned, 2),
    'total_paid_out', ROUND(v_stats.total_paid_out, 2),
    'avg_fee_rate', ROUND(v_stats.avg_fee_rate, 2)
  );
END;
$$;

COMMIT;
