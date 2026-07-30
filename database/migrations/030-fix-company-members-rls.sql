-- 030: Fix self-referencing RLS on company_members
-- The SELECT policy references company_members in its own subquery,
-- PostgreSQL applies RLS to that inner query too → circular → returns nothing.
-- Fix: SECURITY DEFINER function bypasses RLS for the lookup.

-- Helper bypasses RLS to resolve the circular self-reference
CREATE OR REPLACE FUNCTION public.get_my_company_ids()
RETURNS SETOF UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT company_id FROM public.company_members WHERE user_id = auth.uid();
$$;

-- Replace self-referencing SELECT policy
DROP POLICY IF EXISTS "members_view_own_company" ON public.company_members;
CREATE POLICY "members_view_own_company" ON public.company_members
  FOR SELECT USING (company_id IN (SELECT public.get_my_company_ids()));

-- Replace self-referencing admin manage policy
DROP POLICY IF EXISTS "admins_manage_members" ON public.company_members;
CREATE POLICY "admins_manage_members" ON public.company_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.get_my_company_ids() cid
      JOIN public.company_members cm ON cm.company_id = cid
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.company_id = company_members.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.get_my_company_ids() cid
      JOIN public.company_members cm ON cm.company_id = cid
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.company_id = company_members.company_id
    )
  );

-- Fix invites policy too (also references company_members)
DROP POLICY IF EXISTS "admins_manage_invites" ON public.company_invites;
CREATE POLICY "admins_manage_invites" ON public.company_invites
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.get_my_company_ids() cid
      JOIN public.company_members cm ON cm.company_id = cid
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.company_id = company_invites.company_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.get_my_company_ids() cid
      JOIN public.company_members cm ON cm.company_id = cid
      WHERE cm.user_id = auth.uid()
        AND cm.role IN ('owner', 'admin')
        AND cm.company_id = company_invites.company_id
    )
  );
