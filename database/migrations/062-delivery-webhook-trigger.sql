-- Migration 062: Delivery Webhook Trigger
-- Automatically fires a webhook when a load status changes to 'delivered'.
-- Assembles a rich payload with load, carrier, BOL, and rate con data
-- ready for n8n invoice automation.

-- 1. Payload builder — assembles all invoice-relevant data for the delivered load
CREATE OR REPLACE FUNCTION public.build_delivery_payload(p_load_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_payload   jsonb;
  v_load      record;
  v_bid       record;
  v_company   record;
  v_bol       record;
  v_rate_con  record;
BEGIN
  -- Load details
  SELECT id, load_number, origin_city, origin_state, origin_address, origin_zip,
         dest_city, dest_state, dest_address, dest_zip,
         rate_usd, equipment, pickup_date, delivery_date,
         total_miles, weight_lbs, commodity, posted_by, status
    INTO v_load
    FROM loads
   WHERE id = p_load_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'load_not_found');
  END IF;

  -- Accepted bid + carrier info
  SELECT b.id AS bid_id, b.amount_usd, b.carrier_id, b.company_id, b.company_name
    INTO v_bid
    FROM bids b
   WHERE b.load_id = p_load_id
     AND b.status = 'accepted'
   LIMIT 1;

  -- Carrier company details (MC#, DOT#)
  IF v_bid.company_id IS NOT NULL THEN
    SELECT c.name, cv.mc_number, cv.dot_number
      INTO v_company
      FROM companies c
      LEFT JOIN carrier_verifications cv ON cv.company_id = c.id
     WHERE c.id = v_bid.company_id;
  END IF;

  -- Signed BOL
  SELECT d.file_url, d.signed_at, d.signatory_name, d.doc_hash
    INTO v_bol
    FROM documents d
   WHERE d.load_id = p_load_id
     AND d.type = 'bill_of_lading'
     AND d.signed_at IS NOT NULL
   ORDER BY d.signed_at DESC
   LIMIT 1;

  -- Signed Rate Confirmation
  SELECT d.file_url, d.signed_at, d.doc_hash
    INTO v_rate_con
    FROM documents d
   WHERE d.load_id = p_load_id
     AND d.type = 'rate_confirmation'
     AND d.signed_at IS NOT NULL
   ORDER BY d.signed_at DESC
   LIMIT 1;

  -- Assemble payload
  v_payload := jsonb_build_object(
    'event', 'load.delivered',
    'timestamp', NOW()::TEXT,
    'load', jsonb_build_object(
      'id',            v_load.id,
      'load_number',   v_load.load_number,
      'origin',        jsonb_build_object(
        'city', v_load.origin_city, 'state', v_load.origin_state,
        'address', v_load.origin_address, 'zip', v_load.origin_zip
      ),
      'destination',   jsonb_build_object(
        'city', v_load.dest_city, 'state', v_load.dest_state,
        'address', v_load.dest_address, 'zip', v_load.dest_zip
      ),
      'rate_usd',      v_load.rate_usd,
      'equipment',     v_load.equipment,
      'pickup_date',   v_load.pickup_date,
      'delivery_date', v_load.delivery_date,
      'total_miles',   v_load.total_miles,
      'weight_lbs',    v_load.weight_lbs,
      'commodity',     v_load.commodity
    ),
    'carrier', CASE WHEN v_bid IS NOT NULL THEN jsonb_build_object(
      'company_name', COALESCE(v_company.name, v_bid.company_name),
      'mc_number',    v_company.mc_number,
      'dot_number',   v_company.dot_number,
      'bid_amount',   v_bid.amount_usd,
      'carrier_id',   v_bid.carrier_id
    ) ELSE NULL END,
    'bol', CASE WHEN v_bol.file_url IS NOT NULL THEN jsonb_build_object(
      'file_url',       v_bol.file_url,
      'signed_at',      v_bol.signed_at,
      'signatory_name', v_bol.signatory_name,
      'doc_hash',       v_bol.doc_hash
    ) ELSE NULL END,
    'rate_confirmation', CASE WHEN v_rate_con.file_url IS NOT NULL THEN jsonb_build_object(
      'file_url',  v_rate_con.file_url,
      'signed_at', v_rate_con.signed_at,
      'doc_hash',  v_rate_con.doc_hash
    ) ELSE NULL END
  );

  RETURN v_payload;
END;
$$;

-- 2. Trigger function — fires when load status changes to 'delivered'
CREATE OR REPLACE FUNCTION public.on_load_delivered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when status transitions TO 'delivered'
  IF NEW.status = 'delivered' AND (OLD.status IS DISTINCT FROM 'delivered') THEN
    PERFORM trigger_webhook_event(
      'load.delivered',
      build_delivery_payload(NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Attach trigger to loads table
DROP TRIGGER IF EXISTS trg_load_delivered_webhook ON loads;
CREATE TRIGGER trg_load_delivered_webhook
  AFTER UPDATE OF status ON loads
  FOR EACH ROW
  EXECUTE FUNCTION on_load_delivered();
