CREATE INDEX idx_pc_max_price_visible
ON public.products_cache USING btree (preco_base DESC)
WHERE ativo = true
  AND has_image = true
  AND (is_hidden IS NULL OR is_hidden = false)
  AND preco_base > 0;