-- SKU, variacao (cor) e foto do produto em cada linha do pedido de compra,
-- para o conferente ver a cor no recebimento.
alter table public.sistema_compras_itens add column if not exists sku text;
alter table public.sistema_compras_itens add column if not exists variacao text;
alter table public.sistema_compras_itens add column if not exists foto_url text;
