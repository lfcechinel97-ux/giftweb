-- =====================================================================
-- GIFT WEB - Premissas do painel de empate (aba "Pedidos e comissões").
--   custo_fixo_mensal: custo fixo da empresa no mês (sem o imposto, que
--                      já sai de cada venda). Padrão R$ 50.000.
--   cpa_pedido:        custo de aquisição por pedido. Padrão R$ 200.
-- O dashboard lê com select("*") e usa os mesmos padrões se as colunas
-- ainda não existirem; editar pelo dashboard grava aqui (só admin, RLS).
-- =====================================================================
alter table public.sistema_financeiro_config
  add column if not exists custo_fixo_mensal numeric(12,2) not null default 50000,
  add column if not exists cpa_pedido numeric(12,2) not null default 200;

insert into public.sistema_financeiro_config (id) values (true) on conflict (id) do nothing;

-- Realtime: orçamento novo e preço de compra lançado atualizam o painel na hora.
do $$
begin
  alter publication supabase_realtime add table public.sistema_orcamentos;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.sistema_compras_precos;
exception when others then null;
end $$;
