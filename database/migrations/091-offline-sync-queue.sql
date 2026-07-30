-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 091: Offline Support Backend (P4-05)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Rural coverage. Drivers in dead zones need to queue actions (bid, update
-- status, log HOS) and sync when connectivity returns. Server-side conflict
-- resolution ensures data integrity.
--
-- Tables:
--   sync_queue — pending offline operations
--   sync_conflicts — detected conflicts requiring resolution
--
-- RPCs:
--   process_sync_queue() — replay queued operations in order
--   resolve_sync_conflict() — accept local or server version
--   get_sync_status() — user's pending/failed sync count
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── Sync queue ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_queue (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  device_id       text,                         -- Which device queued this

  -- Operation details
  entity_type     text NOT NULL
                    CHECK (entity_type IN ('bid', 'load_status', 'hos_log',
                                           'message', 'location_ping', 'document')),
  operation       text NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_id       uuid,                         -- NULL for creates
  payload         jsonb NOT NULL,               -- Full operation payload
  client_timestamp timestamptz NOT NULL,        -- When user performed action offline

  -- Processing
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed',
                                      'failed', 'conflict')),
  error_message   text,
  attempt_count   integer NOT NULL DEFAULT 0,
  max_attempts    integer NOT NULL DEFAULT 3,
  processed_at    timestamptz,
  server_entity_id uuid,                        -- Resulting entity ID after processing

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_queue_user ON sync_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(status, created_at)
  WHERE status = 'pending';

ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_manage_own_queue" ON sync_queue
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── Sync conflicts ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_conflicts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_queue_id   uuid NOT NULL REFERENCES sync_queue(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entity_type     text NOT NULL,
  entity_id       uuid NOT NULL,

  local_version   jsonb NOT NULL,               -- What the client sent
  server_version  jsonb NOT NULL,               -- Current server state
  conflict_fields text[] NOT NULL,              -- Which fields differ

  resolution      text CHECK (resolution IN ('accept_local', 'accept_server', 'merged')),
  resolved_by     uuid REFERENCES profiles(id),
  resolved_at     timestamptz,

  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_conflicts_user ON sync_conflicts(user_id)
  WHERE resolution IS NULL;

ALTER TABLE sync_conflicts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_manage_own_conflicts" ON sync_conflicts
  FOR ALL USING (user_id = auth.uid());

-- ── Last sync tracking on profiles ──────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- ── RPC: Process sync queue ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_sync_queue(
  p_batch_size integer DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_item       record;
  v_processed  integer := 0;
  v_failed     integer := 0;
  v_conflicts  integer := 0;
  v_result     uuid;
BEGIN
  FOR v_item IN
    SELECT * FROM public.sync_queue
    WHERE user_id = auth.uid()
      AND status = 'pending'
      AND attempt_count < max_attempts
    ORDER BY client_timestamp ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Mark as processing
    UPDATE public.sync_queue SET status = 'processing', attempt_count = attempt_count + 1
      WHERE id = v_item.id;

    BEGIN
      -- Check for conflicts on updates
      IF v_item.operation = 'update' AND v_item.entity_id IS NOT NULL THEN
        -- Simple conflict detection: check if entity was modified after client timestamp
        PERFORM 1 FROM (
          SELECT updated_at FROM public.loads WHERE id = v_item.entity_id AND updated_at > v_item.client_timestamp
          UNION ALL
          SELECT updated_at FROM public.bids WHERE id = v_item.entity_id AND updated_at > v_item.client_timestamp
        ) sub LIMIT 1;

        IF FOUND THEN
          -- Create conflict record
          INSERT INTO public.sync_conflicts (
            sync_queue_id, user_id, entity_type, entity_id,
            local_version, server_version, conflict_fields
          )
          SELECT v_item.id, v_item.user_id, v_item.entity_type, v_item.entity_id,
                 v_item.payload,
                 CASE v_item.entity_type
                   WHEN 'load_status' THEN (SELECT to_jsonb(l) FROM public.loads l WHERE l.id = v_item.entity_id)
                   WHEN 'bid' THEN (SELECT to_jsonb(b) FROM public.bids b WHERE b.id = v_item.entity_id)
                   ELSE '{}'::jsonb
                 END,
                 ARRAY(SELECT jsonb_object_keys(v_item.payload));

          UPDATE public.sync_queue SET status = 'conflict' WHERE id = v_item.id;
          v_conflicts := v_conflicts + 1;
          CONTINUE;
        END IF;
      END IF;

      -- Process based on entity type
      CASE v_item.entity_type
        WHEN 'location_ping' THEN
          -- Location pings are append-only, no conflict possible
          INSERT INTO public.location_pings (
            user_id, lat, lng, accuracy, heading, speed, recorded_at
          ) VALUES (
            v_item.user_id,
            (v_item.payload->>'lat')::numeric,
            (v_item.payload->>'lng')::numeric,
            (v_item.payload->>'accuracy')::numeric,
            (v_item.payload->>'heading')::numeric,
            (v_item.payload->>'speed')::numeric,
            v_item.client_timestamp
          )
          RETURNING id INTO v_result;

        WHEN 'hos_log' THEN
          -- HOS logs are append-only
          INSERT INTO public.hos_duty_log (
            driver_id, status, started_at,
            location_lat, location_lng, location_description,
            odometer_miles, source, notes
          ) VALUES (
            v_item.user_id,
            (v_item.payload->>'status')::public.hos_duty_status,
            v_item.client_timestamp,
            (v_item.payload->>'location_lat')::numeric,
            (v_item.payload->>'location_lng')::numeric,
            v_item.payload->>'location_description',
            (v_item.payload->>'odometer_miles')::numeric,
            'manual',
            v_item.payload->>'notes'
          )
          RETURNING id INTO v_result;

        WHEN 'message' THEN
          INSERT INTO public.messages (
            conversation_id, sender_id, content, created_at
          ) VALUES (
            (v_item.payload->>'conversation_id')::uuid,
            v_item.user_id,
            v_item.payload->>'content',
            v_item.client_timestamp
          )
          RETURNING id INTO v_result;

        ELSE
          -- Generic: mark as failed for manual processing
          UPDATE public.sync_queue
          SET status = 'failed', error_message = 'Unsupported entity type for auto-processing'
          WHERE id = v_item.id;
          v_failed := v_failed + 1;
          CONTINUE;
      END CASE;

      -- Mark as completed
      UPDATE public.sync_queue
      SET status = 'completed', processed_at = now(), server_entity_id = v_result
      WHERE id = v_item.id;
      v_processed := v_processed + 1;

    EXCEPTION WHEN OTHERS THEN
      UPDATE public.sync_queue
      SET status = 'failed', error_message = SQLERRM
      WHERE id = v_item.id;
      v_failed := v_failed + 1;
    END;
  END LOOP;

  -- Update last sync
  UPDATE public.profiles SET last_synced_at = now() WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'processed', v_processed,
    'failed', v_failed,
    'conflicts', v_conflicts,
    'remaining', (
      SELECT COUNT(*) FROM public.sync_queue
      WHERE user_id = auth.uid() AND status = 'pending'
    )
  );
END;
$$;

-- ── RPC: Resolve sync conflict ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_sync_conflict(
  p_conflict_id uuid,
  p_resolution  text  -- 'accept_local' or 'accept_server'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_conflict record;
BEGIN
  SELECT * INTO v_conflict FROM public.sync_conflicts
    WHERE id = p_conflict_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conflict not found');
  END IF;

  IF v_conflict.resolution IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already resolved');
  END IF;

  IF p_resolution = 'accept_local' THEN
    -- Re-queue the original operation with force flag
    UPDATE public.sync_queue
    SET status = 'pending',
        payload = v_conflict.local_version || '{"force_overwrite": true}'::jsonb
    WHERE id = v_conflict.sync_queue_id;
  ELSE
    -- Server wins, discard local change
    UPDATE public.sync_queue SET status = 'completed' WHERE id = v_conflict.sync_queue_id;
  END IF;

  UPDATE public.sync_conflicts
  SET resolution = p_resolution, resolved_by = auth.uid(), resolved_at = now()
  WHERE id = p_conflict_id;

  RETURN jsonb_build_object('success', true, 'resolution', p_resolution);
END;
$$;

-- ── RPC: Get sync status ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_sync_status()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_counts record;
  v_last_sync timestamptz;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status = 'pending')::integer AS pending,
    COUNT(*) FILTER (WHERE status = 'failed')::integer AS failed,
    COUNT(*) FILTER (WHERE status = 'conflict')::integer AS conflicts,
    COUNT(*) FILTER (WHERE status = 'completed' AND processed_at > now() - interval '1 hour')::integer AS recent_completed
  INTO v_counts
  FROM public.sync_queue
  WHERE user_id = auth.uid();

  SELECT last_synced_at INTO v_last_sync FROM public.profiles WHERE id = auth.uid();

  RETURN jsonb_build_object(
    'pending', COALESCE(v_counts.pending, 0),
    'failed', COALESCE(v_counts.failed, 0),
    'conflicts', COALESCE(v_counts.conflicts, 0),
    'recent_completed', COALESCE(v_counts.recent_completed, 0),
    'last_synced_at', v_last_sync,
    'needs_sync', COALESCE(v_counts.pending, 0) > 0
  );
END;
$$;

COMMIT;
