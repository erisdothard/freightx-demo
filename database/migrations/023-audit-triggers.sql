-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 023: Audit Log Database Triggers (Phase 13A)
-- Replaces client-side RPC calls with robust DB triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create generic trigger function
CREATE OR REPLACE FUNCTION public.process_audit_log_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_action      TEXT;
  v_diff        JSONB;
  v_entity_id   TEXT;
  v_entity_type TEXT;
  v_user_id     UUID;
BEGIN
  -- Determine entity_type from table name
  v_entity_type := TG_TABLE_NAME;
  
  -- Try to get the user ID from the request context (Supabase auth)
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Build the diff and determine default action
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_diff := jsonb_build_object('after', row_to_json(NEW));
    v_entity_id := NEW.id::text;
    
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_diff := jsonb_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW));
    v_entity_id := NEW.id::text;
    
    -- --- Specific Override Logic ---
    IF TG_TABLE_NAME = 'loads' THEN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'awarded' THEN
          v_action := 'booking_confirmed';
        ELSE
          v_action := 'status_changed';
        END IF;
      END IF;
      
    ELSIF TG_TABLE_NAME = 'bids' THEN
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        IF NEW.status = 'accepted' THEN
          v_action := 'bid_accepted';
        ELSIF NEW.status = 'declined' THEN
          v_action := 'bid_declined';
        END IF;
      END IF;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_diff := jsonb_build_object('before', row_to_json(OLD));
    v_entity_id := OLD.id::text;
  END IF;

  -- Insert the audit log entry
  INSERT INTO public.audit_log (user_id, action, entity_type, entity_id, diff)
  VALUES (v_user_id, v_action, v_entity_type, v_entity_id, v_diff);

  -- Return appropriately
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to the tables
-- Table: loads
DROP TRIGGER IF EXISTS trg_audit_loads ON public.loads;
CREATE TRIGGER trg_audit_loads
  AFTER INSERT OR UPDATE OR DELETE ON public.loads
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_trigger();

-- Table: bids
DROP TRIGGER IF EXISTS trg_audit_bids ON public.bids;
CREATE TRIGGER trg_audit_bids
  AFTER INSERT OR UPDATE OR DELETE ON public.bids
  FOR EACH ROW EXECUTE FUNCTION public.process_audit_log_trigger();
