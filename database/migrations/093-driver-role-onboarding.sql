-- Migration 093: Driver Role Onboarding
-- Unlocks 'driver' as a valid role for company_invites and company_members,
-- and adds a pre-auth RPC to preview invite details for the onboarding page.

-- ── 1. Fix company_members CHECK constraint ────────────────────
ALTER TABLE public.company_members
  DROP CONSTRAINT IF EXISTS valid_member_role;

ALTER TABLE public.company_members
  ADD CONSTRAINT valid_member_role
  CHECK (role IN ('owner','admin','dispatcher','accounting','viewer','driver'));

-- ── 2. Fix company_invites CHECK constraint ────────────────────
ALTER TABLE public.company_invites
  DROP CONSTRAINT IF EXISTS valid_invite_role;

ALTER TABLE public.company_invites
  ADD CONSTRAINT valid_invite_role
  CHECK (role IN ('admin','dispatcher','accounting','viewer','driver'));

-- ── 3. RPC: get_invite_by_token ────────────────────────────────
-- Callable pre-auth (SECURITY DEFINER). Returns only the fields needed
-- to pre-fill the onboarding page. No company_id or invited_by exposed.
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token TEXT)
RETURNS TABLE (
  email        TEXT,
  role         TEXT,
  company_name TEXT,
  expires_at   TIMESTAMPTZ,
  is_valid     BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.email,
    ci.role,
    co.name AS company_name,
    ci.expires_at,
    (ci.accepted_at IS NULL AND ci.expires_at > NOW()) AS is_valid
  FROM public.company_invites ci
  JOIN public.companies co ON co.id = ci.company_id
  WHERE ci.token = p_token;
END;
$$;
