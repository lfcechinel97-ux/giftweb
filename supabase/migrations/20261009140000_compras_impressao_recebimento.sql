-- =====================================================================
-- GIFT WEB - Pedido de compra: impressão e conferência de recebimento.
--   sistema_compras.impresso_em/por   -> último PDF baixado (com ou sem preço)
--   sistema_compras.recebido_em/por   -> conferência finalizada
--   sistema_compras_itens.qtd_recebida -> quanto chegou de cada produto
--   sistema_compras_itens.conferido_em/por -> item já conferido
-- Status (calculado na tela): aguardando -> conferindo -> RECEBIDO OK ou
-- RECEBIDO C/ FALTAS (algum item com qtd_recebida < quantidade).
-- As policies "admin e producao" já valem para as colunas novas.
-- =====================================================================
alter table public.sistema_compras
  add column if not exists impresso_em timestamptz,
  add column if not exists impresso_por text,
  add column if not exists recebido_em timestamptz,
  add column if not exists recebido_por text;

alter table public.sistema_compras_itens
  add column if not exists qtd_recebida numeric check (qtd_recebida >= 0),
  add column if not exists conferido_em timestamptz,
  add column if not exists conferido_por text;

-- Tempo real: a conferência feita na produção aparece na hora pra quem compra.
do $$
begin
  alter publication supabase_realtime add table public.sistema_compras;
exception when others then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.sistema_compras_itens;
exception when others then null;
end $$;
