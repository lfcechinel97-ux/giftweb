ALTER TABLE public.sistema_orcamentos ADD COLUMN IF NOT EXISTS cliente_snapshot JSONB;
ALTER TABLE public.sistema_pedidos ADD COLUMN IF NOT EXISTS cliente_snapshot JSONB;