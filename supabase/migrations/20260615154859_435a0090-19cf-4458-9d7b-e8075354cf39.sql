
-- sync_log: restrict reads to admins
DROP POLICY IF EXISTS "Public read sync_log" ON public.sync_log;
CREATE POLICY "Admins can read sync_log" ON public.sync_log
  FOR SELECT TO authenticated
  USING (public.is_admin_user());

-- Drop redundant service_role policies on products_cache (service_role bypasses RLS)
DROP POLICY IF EXISTS "Service role can insert products_cache" ON public.products_cache;
DROP POLICY IF EXISTS "Service role can update products_cache" ON public.products_cache;

-- Defense-in-depth restrictive admin-only policies on sistema_* tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sistema_clientes','sistema_orcamentos','sistema_pedidos',
    'sistema_ajustes_estoque','sistema_meios_pagamento',
    'sistema_transportadoras','sistema_origens','sistema_vendedores'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS deny_non_admin ON public.%I;', t);
    EXECUTE format(
      'CREATE POLICY deny_non_admin ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());',
      t
    );
  END LOOP;
END $$;
