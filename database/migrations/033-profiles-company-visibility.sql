-- 033: Let company members see each other's profiles
-- Previously profiles_select_own only allowed reading your own profile,
-- so carrier couldn't see driver names in Team pages.

CREATE POLICY "profiles_select_company_members" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT cm2.user_id FROM public.company_members cm2
      WHERE cm2.company_id IN (
        SELECT cm1.company_id FROM public.company_members cm1
        WHERE cm1.user_id = auth.uid()
      )
    )
    OR id = auth.uid()
  );
