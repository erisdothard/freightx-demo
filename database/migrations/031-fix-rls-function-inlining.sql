-- 031: Fix get_my_company_ids() — switch to plpgsql to prevent inlining
-- PostgreSQL inlines LANGUAGE sql functions, bypassing SECURITY DEFINER.
-- plpgsql cannot be inlined, so SECURITY DEFINER actually takes effect.

CREATE OR REPLACE FUNCTION public.get_my_company_ids()
RETURNS SETOF UUID LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN QUERY SELECT company_id FROM public.company_members WHERE user_id = auth.uid();
END;
$$;
