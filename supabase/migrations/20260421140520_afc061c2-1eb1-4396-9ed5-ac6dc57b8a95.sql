ALTER TABLE public.products_cache
ADD COLUMN IF NOT EXISTS preco_custo_manual boolean NOT NULL DEFAULT false;