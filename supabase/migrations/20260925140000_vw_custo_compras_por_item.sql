-- Custo REAL de compra por produto do pedido (para calcular lucro depois).
-- Soma todas as compras que cobriram aquele produto. security_invoker:
-- os precos so existem para admin (RLS), entao so o admin enxerga linhas.
create or replace view public.vw_custo_compras_por_item as
select
  ci.producao_item_id,
  ci.pedido_numero,
  min(ci.produto_nome) as produto_nome,
  sum(ci.quantidade) as quantidade_comprada,
  sum(ci.quantidade * cp.valor_unitario) as custo_total,
  case when sum(ci.quantidade) > 0
       then sum(ci.quantidade * cp.valor_unitario) / sum(ci.quantidade) end as custo_unitario_medio
from public.sistema_compras_itens ci
join public.sistema_compras_precos cp on cp.compra_item_id = ci.id
where ci.producao_item_id is not null
group by ci.producao_item_id, ci.pedido_numero;

alter view public.vw_custo_compras_por_item set (security_invoker = on);
revoke all on public.vw_custo_compras_por_item from anon;
grant select on public.vw_custo_compras_por_item to authenticated;
