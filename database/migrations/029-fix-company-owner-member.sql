-- 029: Fix company owner not in company_members (chicken-and-egg RLS issue)

-- Auto-add company owner to company_members on INSERT
CREATE OR REPLACE FUNCTION public.auto_add_company_owner()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.company_members (company_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (company_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_add_company_owner ON public.companies;
CREATE TRIGGER trg_auto_add_company_owner
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_company_owner();

-- Allow company owners to self-insert (safety net)
CREATE POLICY "owner_self_insert" ON public.company_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND role = 'owner'
    AND company_id IN (
      SELECT id FROM public.companies WHERE owner_id = auth.uid()
    )
  );

-- Backfill existing companies missing from company_members
INSERT INTO public.company_members (company_id, user_id, role)
SELECT id, owner_id, 'owner'
  FROM public.companies
 WHERE owner_id IS NOT NULL
ON CONFLICT (company_id, user_id) DO NOTHING;
