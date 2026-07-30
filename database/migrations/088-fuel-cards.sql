-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 088: Fuel Card / Discounts (P4-02)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Carrier retention tool. Fuel is 30-40% of operating costs. Offering
-- discounted fuel through partner networks creates switching-cost lock-in.
--
-- Tables:
--   fuel_cards — issued fuel cards per company
--   fuel_transactions — usage log
--
-- RPCs:
--   issue_fuel_card() — provision a new fuel card
--   record_fuel_transaction() — log a fuel purchase
--   get_fuel_summary() — spending analytics
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Fuel cards ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_cards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  card_number_masked text NOT NULL,          -- Last 4 digits only: ****1234
  provider          text NOT NULL
                      CHECK (provider IN ('pilot_flying_j', 'loves', 'ta_petro',
                                          'speedway', 'comdata', 'efs', 'wex')),
  assigned_driver   uuid REFERENCES profiles(id),
  assigned_truck    uuid REFERENCES trucks(id),
  spending_limit_usd numeric(10,2),
  daily_limit_usd  numeric(10,2),
  discount_cents_per_gallon numeric(4,2) DEFAULT 0,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'suspended', 'cancelled')),
  activated_at      timestamptz NOT NULL DEFAULT now(),
  cancelled_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fuel_cards_company ON fuel_cards(company_id);
CREATE INDEX IF NOT EXISTS idx_fuel_cards_driver ON fuel_cards(assigned_driver);

ALTER TABLE fuel_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_manage_fuel_cards" ON fuel_cards
  FOR ALL USING (
    company_id IN (
      SELECT company_id FROM company_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Drivers can view their assigned cards
CREATE POLICY "driver_view_own_card" ON fuel_cards
  FOR SELECT USING (assigned_driver = auth.uid());

-- ── Fuel transactions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fuel_card_id      uuid NOT NULL REFERENCES fuel_cards(id) ON DELETE CASCADE,
  company_id        uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  driver_id         uuid REFERENCES profiles(id),
  load_id           uuid REFERENCES loads(id),
  truck_id          uuid REFERENCES trucks(id),

  transaction_date  timestamptz NOT NULL DEFAULT now(),
  gallons           numeric(8,3) NOT NULL,
  price_per_gallon  numeric(6,4) NOT NULL,
  discount_applied  numeric(6,4) DEFAULT 0,     -- Cents/gal discount
  total_usd         numeric(10,2) GENERATED ALWAYS AS (
    gallons * (price_per_gallon - discount_applied)
  ) STORED,
  retail_price      numeric(6,4),               -- Pre-discount price
  savings_usd       numeric(10,2) GENERATED ALWAYS AS (
    gallons * discount_applied
  ) STORED,

  fuel_type         text DEFAULT 'diesel'
                      CHECK (fuel_type IN ('diesel', 'def', 'gasoline')),
  location_name     text,
  location_city     text,
  location_state    text,
  odometer_miles    numeric(10,1),

  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fuel_tx_card ON fuel_transactions(fuel_card_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_tx_company ON fuel_transactions(company_id, transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_tx_load ON fuel_transactions(load_id);

ALTER TABLE fuel_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_view_fuel_tx" ON fuel_transactions
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM company_members WHERE user_id = auth.uid()
    )
  );

-- System inserts via RPC
CREATE POLICY "system_insert_fuel_tx" ON fuel_transactions
  FOR INSERT WITH CHECK (true);

-- ── RPC: Issue fuel card ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.issue_fuel_card(
  p_company_id        uuid,
  p_card_number_last4 text,
  p_provider          text,
  p_assigned_driver   uuid DEFAULT NULL,
  p_assigned_truck    uuid DEFAULT NULL,
  p_spending_limit    numeric DEFAULT NULL,
  p_daily_limit       numeric DEFAULT NULL,
  p_discount_cpg      numeric DEFAULT 0
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_card_id uuid;
BEGIN
  -- Verify caller is admin
  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = p_company_id AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.fuel_cards (
    company_id, card_number_masked, provider,
    assigned_driver, assigned_truck,
    spending_limit_usd, daily_limit_usd,
    discount_cents_per_gallon
  ) VALUES (
    p_company_id, '****' || p_card_number_last4, p_provider,
    p_assigned_driver, p_assigned_truck,
    p_spending_limit, p_daily_limit,
    p_discount_cpg
  )
  RETURNING id INTO v_card_id;

  RETURN v_card_id;
END;
$$;

-- ── RPC: Record fuel transaction ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_fuel_transaction(
  p_fuel_card_id      uuid,
  p_gallons           numeric,
  p_price_per_gallon  numeric,
  p_fuel_type         text DEFAULT 'diesel',
  p_load_id           uuid DEFAULT NULL,
  p_truck_id          uuid DEFAULT NULL,
  p_location_name     text DEFAULT NULL,
  p_location_city     text DEFAULT NULL,
  p_location_state    text DEFAULT NULL,
  p_odometer_miles    numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_card  record;
  v_tx_id uuid;
BEGIN
  SELECT * INTO v_card FROM public.fuel_cards WHERE id = p_fuel_card_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fuel card not found'; END IF;
  IF v_card.status != 'active' THEN RAISE EXCEPTION 'Fuel card is not active'; END IF;

  INSERT INTO public.fuel_transactions (
    fuel_card_id, company_id, driver_id, load_id, truck_id,
    gallons, price_per_gallon, discount_applied,
    retail_price, fuel_type,
    location_name, location_city, location_state, odometer_miles
  ) VALUES (
    p_fuel_card_id, v_card.company_id, v_card.assigned_driver,
    p_load_id, COALESCE(p_truck_id, v_card.assigned_truck),
    p_gallons, p_price_per_gallon, v_card.discount_cents_per_gallon,
    p_price_per_gallon, p_fuel_type,
    p_location_name, p_location_city, p_location_state, p_odometer_miles
  )
  RETURNING id INTO v_tx_id;

  RETURN v_tx_id;
END;
$$;

-- ── RPC: Get fuel summary ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_fuel_summary(
  p_company_id uuid,
  p_days       integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_stats record;
BEGIN
  SELECT
    COUNT(*)::integer AS transaction_count,
    ROUND(SUM(gallons)::numeric, 1) AS total_gallons,
    ROUND(SUM(total_usd)::numeric, 2) AS total_spent,
    ROUND(SUM(savings_usd)::numeric, 2) AS total_savings,
    ROUND(AVG(price_per_gallon - discount_applied)::numeric, 4) AS avg_net_price,
    ROUND(AVG(price_per_gallon)::numeric, 4) AS avg_retail_price,
    COUNT(DISTINCT fuel_card_id)::integer AS active_cards,
    COUNT(DISTINCT driver_id)::integer AS active_drivers
  INTO v_stats
  FROM public.fuel_transactions
  WHERE company_id = p_company_id
    AND transaction_date >= now() - (p_days || ' days')::interval;

  RETURN jsonb_build_object(
    'period_days', p_days,
    'transaction_count', COALESCE(v_stats.transaction_count, 0),
    'total_gallons', v_stats.total_gallons,
    'total_spent', v_stats.total_spent,
    'total_savings', COALESCE(v_stats.total_savings, 0),
    'avg_net_price', v_stats.avg_net_price,
    'avg_retail_price', v_stats.avg_retail_price,
    'active_cards', COALESCE(v_stats.active_cards, 0),
    'active_drivers', COALESCE(v_stats.active_drivers, 0)
  );
END;
$$;

COMMIT;
