-- 032: Nuke circular RLS on company_members
-- Previous approach (SECURITY DEFINER helper function) failed due to inlining.
-- New approach: use companies table (no self-reference) to check ownership.

-- Drop the broken helper function (CASCADE drops dependent policies)
DROP FUNCTION IF EXISTS public.get_my_company_ids() CASCADE;

-- Drop any remaining policies
DROP POLICY IF EXISTS "members_view_own_company" ON public.company_members;
DROP POLICY IF EXISTS "members_view_company" ON public.company_members;
DROP POLICY IF EXISTS "admins_manage_members" ON public.company_members;
DROP POLICY IF EXISTS "owner_manage_members" ON public.company_members;
DROP POLICY IF EXISTS "owner_self_insert" ON public.company_members;

-- SELECT: owners see all members (via companies table), others see own row
CREATE POLICY "members_view_company" ON public.company_members
  FOR SELECT USING (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
    OR user_id = auth.uid()
  );

-- INSERT/UPDATE/DELETE: only company owners
CREATE POLICY "owner_manage_members" ON public.company_members
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  ) WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );

-- Fix invites policies too
DROP POLICY IF EXISTS "admins_manage_invites" ON public.company_invites;
CREATE POLICY "admins_manage_invites" ON public.company_invites
  FOR ALL USING (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  ) WITH CHECK (
    company_id IN (SELECT id FROM public.companies WHERE owner_id = auth.uid())
  );
