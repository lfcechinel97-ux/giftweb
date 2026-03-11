
-- Allow service_role to insert into sync_log (edge function uses service_role key)
CREATE POLICY "Service role can insert sync_log" ON public.sync_log
  FOR INSERT TO service_role WITH CHECK (true);

-- Allow service_role to insert/update products_cache
CREATE POLICY "Service role can insert products_cache" ON public.products_cache
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can update products_cache" ON public.products_cache
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);
