
ALTER TABLE public.products_cache
  ADD COLUMN IF NOT EXISTS produto_pai uuid DEFAULT null,
  ADD COLUMN IF NOT EXISTS is_variante boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_produto_pai
ON products_cache(produto_pai)
WHERE produto_pai IS NOT NULL;
