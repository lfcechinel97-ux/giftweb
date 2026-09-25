-- =====================================================================
-- GIFT WEB - Financeiro por pedido (dashboard de pedidos, so admin).
--  * sistema_pedido_financeiro: custos/ajustes lancados por pedido.
--  * meios de pagamento: cartao de credito 1x..12x com as taxas da tabela
--    da maquininha (mesmas para Mastercard, Visa, Elo e Amex).
-- =====================================================================
create table if not exists public.sistema_pedido_financeiro (
  pedido_id uuid primary key references public.sistema_pedidos(id) on delete cascade,
  custo_produto numeric(12,2),          -- null = usa compras / custo do catalogo
  custo_personalizacao numeric(12,2) not null default 0,
  taxa_cartao_pct numeric(6,3),         -- null = usa a taxa do meio de pagamento
  frete numeric(12,2),                  -- null = frete CIF do pedido
  valor_recebido numeric(12,2) not null default 0,
  atualizado_em timestamptz not null default now()
);

alter table public.sistema_pedido_financeiro enable row level security;
drop policy if exists "somente admin" on public.sistema_pedido_financeiro;
create policy "somente admin" on public.sistema_pedido_financeiro for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
revoke all on public.sistema_pedido_financeiro from anon;
grant select, insert, update, delete on public.sistema_pedido_financeiro to authenticated;

-- Realtime (o dashboard recalcula quando qualquer usuario lanca algo)
do $$
begin
  alter publication supabase_realtime add table public.sistema_pedido_financeiro;
exception when others then null;
end $$;

-- Cartao de credito 1x..12x. Nao mexe nos meios que ja existem com o mesmo nome.
insert into public.sistema_meios_pagamento (nome, taxa_pct, ativo)
select v.nome, v.taxa, true
from (values
  ('Cartão de crédito 1x', 3.66), ('Cartão de crédito 2x', 4.58), ('Cartão de crédito 3x', 5.47),
  ('Cartão de crédito 4x', 6.36), ('Cartão de crédito 5x', 7.25), ('Cartão de crédito 6x', 8.14),
  ('Cartão de crédito 7x', 10.23), ('Cartão de crédito 8x', 11.12), ('Cartão de crédito 9x', 12.01),
  ('Cartão de crédito 10x', 12.90), ('Cartão de crédito 11x', 13.79), ('Cartão de crédito 12x', 14.68)
) as v(nome, taxa)
where not exists (select 1 from public.sistema_meios_pagamento m where m.nome = v.nome);

-- Os cartoes "ate Nx" da semente antiga tinham taxas aproximadas: saem da lista
-- de escolha (pedidos antigos que os usam continuam apontando para eles).
update public.sistema_meios_pagamento set ativo = false
where nome in ('Cartão de crédito até 3x', 'Cartão de crédito até 6x', 'Cartão de crédito até 10x');

-- Garante a taxa certa nos que ja existiam (ex.: o 12x da semente antiga estava em 7,25%).
update public.sistema_meios_pagamento m set taxa_pct = v.taxa
from (values
  ('Cartão de crédito 1x', 3.66), ('Cartão de crédito 2x', 4.58), ('Cartão de crédito 3x', 5.47),
  ('Cartão de crédito 4x', 6.36), ('Cartão de crédito 5x', 7.25), ('Cartão de crédito 6x', 8.14),
  ('Cartão de crédito 7x', 10.23), ('Cartão de crédito 8x', 11.12), ('Cartão de crédito 9x', 12.01),
  ('Cartão de crédito 10x', 12.90), ('Cartão de crédito 11x', 13.79), ('Cartão de crédito 12x', 14.68)
) as v(nome, taxa)
where m.nome = v.nome;
