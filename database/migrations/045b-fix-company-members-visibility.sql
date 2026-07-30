-- 045: Fix company_members visibility — all members see each other
-- Migration 032 restricted SELECT to owners + own row only.
-- Non-owner members (viewer, dispatcher, etc.) could only see themselves.
-- Fix: SECURITY DEFINER helper (plpgsql = no inlining) to break circular RLS.

CREATE OR REPLACE FUNCTION public.get_my_company_ids()
RETURNS SETOF UUID LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY SELECT company_id FROM public.company_members WHERE user_id = auth.uid();
END;
$$;

-- Replace SELECT policy: any member can see all members in their company
DROP POLICY IF EXISTS "members_view_company" ON public.company_members;
CREATE POLICY "members_view_company" ON public.company_members
  FOR SELECT USING (
    company_id IN (SELECT public.get_my_company_ids())
  );
