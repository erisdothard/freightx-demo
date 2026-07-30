-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 020: Audit Log (Phase 13A)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,        -- created|updated|deleted|status_changed|bid_accepted|bid_declined|booking_confirmed|payment_recorded
  entity_type TEXT NOT NULL,        -- load|bid|booking|document|payment|profile|company
  entity_id   TEXT NOT NULL,
  diff        JSONB,                -- {before: {...}, after: {...}}
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_user_idx   ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_action_idx ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS audit_log_time_idx   ON public.audit_log(created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can read all audit logs
CREATE POLICY "admins_read_audit_log" ON public.audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Service can insert audit entries
CREATE POLICY "authenticated_insert_audit" ON public.audit_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ── RPC: write_audit_log ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_action      TEXT,
  p_entity_type TEXT,
  p_entity_id   TEXT,
  p_diff        JSONB DEFAULT NULL,
  p_ip          TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, diff, ip_address)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, p_diff, p_ip)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
