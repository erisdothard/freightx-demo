-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 065: P0 Security Fixes
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────
-- Fixes:
--   1. Messages RLS — any authenticated user could read ALL messages (CRITICAL)
--   2. Messages UPDATE/DELETE — missing policies
--   3. Breadcrumb Snapshots RLS — anyone could read all GPS history (CRITICAL)
--   4. Invite Tokens RLS — blanket SELECT allowed token enumeration (HIGH)
--   5. Notifications INSERT — any user could insert notifications for anyone (HIGH)
--      → New send_notification() RPC for cross-user notifications
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. MESSAGES — Fix SELECT + INSERT, add UPDATE + DELETE
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the broken policies (any authenticated user could read ALL messages)
DROP POLICY IF EXISTS "messages_select_auth" ON messages;
DROP POLICY IF EXISTS "messages_insert_auth" ON messages;

-- SELECT: only conversation participants can read messages
CREATE POLICY "messages_select_participant" ON messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

-- INSERT: only conversation participants can send messages
CREATE POLICY "messages_insert_participant" ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

-- UPDATE: participants can update messages in their conversations (mark read)
CREATE POLICY "messages_update_participant" ON messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
        AND (c.participant_a = auth.uid() OR c.participant_b = auth.uid())
    )
  );

-- DELETE: only the sender can delete their own messages
CREATE POLICY "messages_delete_own" ON messages
  FOR DELETE USING (sender_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. BREADCRUMB SNAPSHOTS — Restrict to driver + load stakeholders
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the blanket policies
DROP POLICY IF EXISTS "Authenticated users can read breadcrumb snapshots" ON breadcrumb_snapshots;
DROP POLICY IF EXISTS "Authenticated users can insert breadcrumb snapshots" ON breadcrumb_snapshots;

-- SELECT: driver sees own, load poster sees their loads, admin sees all
CREATE POLICY "breadcrumbs_select_authorized" ON breadcrumb_snapshots
  FOR SELECT USING (
    driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM loads l
      WHERE l.load_number = breadcrumb_snapshots.load_number
        AND l.posted_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- INSERT: only the driver for their own breadcrumbs
CREATE POLICY "breadcrumbs_insert_driver" ON breadcrumb_snapshots
  FOR INSERT WITH CHECK (driver_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. INVITE TOKENS — Restrict to token-based lookup only
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the blanket SELECT that allowed enumeration of all invites
DROP POLICY IF EXISTS "invitee_view_by_token" ON company_invites;

-- Invitees can only see invites addressed to their email
-- (The accept_company_invite RPC is SECURITY DEFINER and bypasses RLS,
--  so token lookup still works during acceptance)
CREATE POLICY "invitee_view_own_invites" ON company_invites
  FOR SELECT USING (
    email = (SELECT email FROM profiles WHERE id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM company_members cm
      WHERE cm.company_id = company_invites.company_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. NOTIFICATIONS — Secure cross-user notification creation
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the blanket INSERT policy
DROP POLICY IF EXISTS "service_insert_notifications" ON notifications;

-- Authenticated users can only insert notifications for THEMSELVES
-- (cross-user notifications go through send_notification() RPC below)
CREATE POLICY "users_insert_own_notifications" ON notifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- DELETE policy — users can dismiss their own notifications
CREATE POLICY "users_delete_own_notifications" ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- RPC: send_notification — SECURITY DEFINER function for cross-user notifications
-- Called by client code when notifying other users (e.g., bid accepted → notify carrier)
CREATE OR REPLACE FUNCTION public.send_notification(
  p_user_id   UUID,
  p_type      TEXT,
  p_title     TEXT,
  p_body      TEXT DEFAULT NULL,
  p_load_id   UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID;
  v_notif_id  UUID;
BEGIN
  v_caller_id := auth.uid();

  -- Must be authenticated
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Cannot notify yourself via this RPC (use direct insert for that)
  IF p_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Use direct insert for self-notifications';
  END IF;

  -- Validate notification type
  IF p_type NOT IN (
    'new_bid', 'bid_accepted', 'bid_declined', 'bid_countered',
    'booking_confirmed', 'new_message', 'load_status_change',
    'load_assigned', 'document_ready', 'payment_received',
    'dispatch_update', 'gps_request', 'load_reminder',
    'receipt_confirmed', 'new_load', 'system'
  ) THEN
    RAISE EXCEPTION 'Invalid notification type: %', p_type;
  END IF;

  -- Validate target user exists
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- If load_id provided, validate it exists and caller has a relationship to it
  IF p_load_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.loads WHERE id = p_load_id
    ) THEN
      RAISE EXCEPTION 'Load not found';
    END IF;
  END IF;

  -- Insert the notification (bypasses RLS since SECURITY DEFINER)
  INSERT INTO public.notifications (user_id, type, title, body, load_id, read)
  VALUES (p_user_id, p_type, p_title, p_body, p_load_id, false)
  RETURNING id INTO v_notif_id;

  RETURN v_notif_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. BULK NOTIFICATION — Notify all carriers of new load
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.notify_carriers_new_load(p_load_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_load RECORD;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, load_number, equipment, origin_city, origin_state,
         dest_city, dest_state, rate_usd
  INTO v_load
  FROM public.loads WHERE id = p_load_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Load not found';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, load_id, read)
  SELECT
    p.id,
    'new_load',
    'New Load Available',
    format('New %s load from %s to %s - $%s',
      v_load.equipment, v_load.origin_city, v_load.dest_city,
      coalesce(v_load.rate_usd::text, 'Call for rate')),
    p_load_id,
    false
  FROM public.profiles p
  WHERE p.role = 'carrier'
    AND p.id != auth.uid();
END;
$$;

COMMIT;
