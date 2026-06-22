CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_pc_categoria_estoque
  ON public.products_cache (categoria, estoque DESC)
  WHERE ativo = true AND has_image = true AND is_variante = false;

CREATE INDEX IF NOT EXISTS idx_pc_updated_at
  ON public.products_cache (updated_at DESC)
  WHERE ativo = true AND has_image = true AND is_variante = false;

CREATE INDEX IF NOT EXISTS idx_pc_categoria_manual_trgm
  ON public.products_cache USING gin (categoria_manual gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pc_categoria_trgm
  ON public.products_cache USING gin (categoria gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pc_preco_custo
  ON public.products_cache (preco_custo)
  WHERE ativo = true AND has_image = true;

CREATE INDEX IF NOT EXISTS idx_pc_busca_trgm
  ON public.products_cache USING gin (busca gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_pc_relevancia
  ON public.products_cache (sort_estoque ASC, estoque_total DESC)
  WHERE ativo = true AND has_image = true AND is_variante = false;