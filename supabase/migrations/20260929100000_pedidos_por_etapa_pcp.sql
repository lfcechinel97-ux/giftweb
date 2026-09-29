-- =====================================================================
-- GIFT WEB - Filtro das abas de Pedidos pela ETAPA REAL (coluna do PCP),
-- não pelo status bruto do pedido. Um pedido com produtos em colunas
-- diferentes passa a contar/aparecer em CADA aba correspondente (ele já
-- mostra mais de uma etiqueta de etapa na tela).
--
--   sistema_pedidos_ids_por_coluna(coluna) -> ids dos pedidos com pelo
--     menos um produto naquela coluna (ou o próprio status do pedido,
--     quando ele ainda não tem produto de produção).
--   sistema_contar_pedidos_por_etapa(vendedor) -> total de pedidos por
--     coluna, na mesma regra acima (para os números das abas).
-- =====================================================================

create or replace function public.sistema_pedidos_ids_por_coluna(p_coluna text)
returns setof uuid
language sql
stable
security invoker
set search_path = public
as $$
  select p.id
  from public.sistema_pedidos p
  where exists (
    select 1
    from public.sistema_producao_itens pi
    join public.sistema_status s on s.slug = pi.status
    where pi.pedido_id = p.id and s.coluna_pcp = p_coluna
  )
  or (
    not exists (select 1 from public.sistema_producao_itens pi2 where pi2.pedido_id = p.id)
    and exists (
      select 1 from public.sistema_status s2
      where s2.slug = p.status and s2.coluna_pcp = p_coluna
    )
  );
$$;

grant execute on function public.sistema_pedidos_ids_por_coluna(text) to authenticated;

create or replace function public.sistema_contar_pedidos_por_etapa(p_vendedor_id uuid default null)
returns table (coluna_pcp text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select pi.pedido_id, s.coluna_pcp as coluna
    from public.sistema_producao_itens pi
    join public.sistema_pedidos p on p.id = pi.pedido_id
    join public.sistema_status s on s.slug = pi.status
    where p_vendedor_id is null or p.vendedor_id = p_vendedor_id
    union
    select p.id, s2.coluna_pcp
    from public.sistema_pedidos p
    join public.sistema_status s2 on s2.slug = p.status
    where not exists (select 1 from public.sistema_producao_itens pi2 where pi2.pedido_id = p.id)
      and (p_vendedor_id is null or p.vendedor_id = p_vendedor_id)
  )
  select coluna, count(distinct pedido_id) from base group by coluna;
$$;

grant execute on function public.sistema_contar_pedidos_por_etapa(uuid) to authenticated;
