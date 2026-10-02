-- =====================================================================
-- GIFT WEB - sistema_pcp_terceirizada() ganha os campos que faltavam
-- pro card do dashboard da terceirizada ficar com a MESMA cara do card
-- do PCP interno: aplicações (p/ o selo de técnica "Laser · 2 aplicações")
-- e o total de itens do pedido (p/ o "Item 2/5").
--
-- Precisa DROP antes do CREATE porque mudar as colunas de uma função que
-- devolve TABLE não é um "replace" válido em Postgres.
-- =====================================================================
drop function if exists public.sistema_pcp_terceirizada();

create or replace function public.sistema_pcp_terceirizada()
returns table (
  producao_id uuid,
  pedido_numero text,
  coluna_pcp text,
  produto_nome text,
  mockup_url text,
  imagem_catalogo_url text,
  quantidade numeric,
  personalizacao text,
  aplicacoes int,
  observacao text,
  tags text[],
  teste_anexo_url text,
  producao_anexo_url text,
  producao_anexo_tipo text,
  volumes jsonb,
  item_posicao int,
  item_total_pedido int,
  etapa_desde timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    pi.id as producao_id,
    p.numero::text as pedido_numero,
    s.coluna_pcp,
    it.item ->> 'nome' as produto_nome,
    it.item ->> 'mockupImagem' as mockup_url,
    it.item ->> 'imagem' as imagem_catalogo_url,
    (it.item ->> 'quantidade')::numeric as quantidade,
    it.item ->> 'personalizacao' as personalizacao,
    (it.item ->> 'aplicacoes')::int as aplicacoes,
    it.item ->> 'observacao' as observacao,
    pi.tags,
    pi.teste_anexo_url,
    pi.producao_anexo_url,
    pi.producao_anexo_tipo,
    pi.volumes,
    it.posicao::int as item_posicao,
    (select count(*)::int from public.sistema_producao_itens x where x.pedido_id = pi.pedido_id) as item_total_pedido,
    coalesce(
      (select hh.created_at from public.sistema_producao_historico hh
        where hh.producao_item_id = pi.id
        order by hh.created_at desc limit 1),
      pi.created_at) as etapa_desde
  from public.sistema_producao_itens pi
  join public.sistema_pedidos p on p.id = pi.pedido_id
  join public.sistema_status s on s.slug = pi.status
  cross join lateral (
    select e.value as item, e.ord as posicao
    from jsonb_array_elements(p.itens) with ordinality e(value, ord)
    where (e.value ->> 'id')::uuid = pi.item_id
    limit 1
  ) it
  where pi.terceirizada_id = public.terceirizada_id_atual()
    and public.terceirizada_id_atual() is not null
    and s.coluna_pcp in ('teste_fisico_terceirizada', 'em_producao_terceirizada', 'inserir_medidas')
$$;

revoke all on function public.sistema_pcp_terceirizada() from public, anon;
grant execute on function public.sistema_pcp_terceirizada() to authenticated;
