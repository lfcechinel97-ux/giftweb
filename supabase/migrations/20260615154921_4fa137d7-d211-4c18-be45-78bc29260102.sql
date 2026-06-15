
DROP POLICY IF EXISTS "Anon can insert leads" ON public.leads;
CREATE POLICY "Anon can insert leads" ON public.leads
  FOR INSERT TO anon
  WITH CHECK (email IS NOT NULL AND length(btrim(email)) >= 5 AND position('@' in email) > 1);
