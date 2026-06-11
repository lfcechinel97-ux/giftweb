
-- Restrict leads SELECT to admins only
DROP POLICY IF EXISTS "Authenticated can read leads" ON public.leads;
CREATE POLICY "Admins can read leads" ON public.leads
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = auth.uid()));

-- Restrict spotlight_products writes to admins
DROP POLICY IF EXISTS "admin_write" ON public.spotlight_products;
CREATE POLICY "admin_write_spotlight_products" ON public.spotlight_products
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE admin_users.id = auth.uid()));
