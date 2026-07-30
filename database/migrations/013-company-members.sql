-- ─────────────────────────────────────────────────────────────────────────────
-- FreightX — Migration 013: Multi-User Company Accounts (Phase 13B)
-- Run in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Company Members ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'viewer',  -- owner|admin|dispatcher|accounting|viewer
  invited_by  UUID REFERENCES public.profiles(id),
  joined_at   TIMESTAMPTZ DEFAULT NOW(),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (company_id, user_id),
  CONSTRAINT valid_member_role CHECK (role IN ('owner','admin','dispatcher','accounting','viewer'))
);

CREATE INDEX IF NOT EXISTS company_members_company_idx ON public.company_members(company_id);
CREATE INDEX IF NOT EXISTS company_members_user_idx    ON public.company_members(user_id);

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Members can see their own company memberships
CREATE POLICY "members_view_own_company" ON public.company_members
  FOR SELECT USING (
    company_id IN (
      SELECT company_id FROM public.company_members WHERE user_id = auth.uid()
    )
  );

-- Only company admins/owners can manage members
CREATE POLICY "admins_manage_members" ON public.company_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = company_members.company_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = company_members.company_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- ── Company Invites ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_invites (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'viewer',
  token       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by  UUID REFERENCES public.profiles(id),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_invite_role CHECK (role IN ('admin','dispatcher','accounting','viewer'))
);

CREATE INDEX IF NOT EXISTS company_invites_token_idx   ON public.company_invites(token);
CREATE INDEX IF NOT EXISTS company_invites_email_idx   ON public.company_invites(email);
CREATE INDEX IF NOT EXISTS company_invites_company_idx ON public.company_invites(company_id);

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_invites" ON public.company_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = company_invites.company_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.company_members
      WHERE company_id = company_invites.company_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Invitee can see their invite by token (public read on token lookup)
CREATE POLICY "invitee_view_by_token" ON public.company_invites
  FOR SELECT USING (true);

-- ── RPC: accept_company_invite ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.accept_company_invite(p_token TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_invite RECORD;
BEGIN
  SELECT * INTO v_invite
    FROM public.company_invites
   WHERE token = p_token
     AND accepted_at IS NULL
     AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or expired';
  END IF;

  -- Add to company_members
  INSERT INTO public.company_members (company_id, user_id, role, invited_by)
  VALUES (v_invite.company_id, auth.uid(), v_invite.role, v_invite.invited_by)
  ON CONFLICT (company_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- Mark invite as accepted
  UPDATE public.company_invites SET accepted_at = NOW() WHERE id = v_invite.id;
END;
$$;

-- ── Backfill: make current company owners members ────────────────────────────
INSERT INTO public.company_members (company_id, user_id, role)
SELECT id, owner_id, 'owner'
  FROM public.companies
 WHERE owner_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;
