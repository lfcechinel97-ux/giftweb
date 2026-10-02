-- =====================================================================
-- GIFT WEB - Duas melhorias no chat/dashboard de terceirizada:
--
-- 1) sistema_mencoes_pendentes(): quem foi @mencionado e AINDA NÃO VIU,
--    por item -- diferente de sistema_chat_resumo() (que é "o que EU não
--    li"), esta é pública pra quem tem acesso ao item: todo mundo vê a
--    etiqueta "@Fulano" no card até o Fulano em pessoa abrir o chat.
--
-- 2) sistema_pcp_terceirizada() ganha os dados do link de O.P.
--    terceirizada (medida da logo + arquivo da logo) -- a terceirizada
--    via ver isso direto no card dela, sem precisar que o admin gere e
--    mande o link separado.
-- =====================================================================

create or replace function public.sistema_mencoes_pendentes()
returns table (producao_item_id uuid, mencionado_nome text)
language sql stable security definer set search_path = public as $$
  select distinct c.producao_item_id, coalesce(nullif(trim(a.nome), ''), a.email) as mencionado_nome
  from public.sistema_producao_comentarios c
  cross join lateral unnest(c.mencionados) as m(user_id)
  join public.admin_users a on a.id = m.user_id
  join public.sistema_producao_itens pi on pi.id = c.producao_item_id
  where not (m.user_id = any(c.lido_por))
    and (
      public.is_admin_user()
      or (public.terceirizada_id_atual() is not null and pi.terceirizada_id = public.terceirizada_id_atual())
    )
$$;

revoke all on function public.sistema_mencoes_pendentes() from public, anon;
grant execute on function public.sistema_mencoes_pendentes() to authenticated;

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
  pedido_observacoes text,
  tags text[],
  teste_anexo_url text,
  producao_anexo_url text,
  producao_anexo_tipo text,
  volumes jsonb,
  item_posicao int,
  item_total_pedido int,
  etapa_desde timestamptz,
  logo_url text,
  logo_dimensao_cm numeric,
  logo_dimensao_tipo text
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
    p.observacoes as pedido_observacoes,
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
      pi.created_at) as etapa_desde,
    opl.conteudo ->> 'arte_url' as logo_url,
    opl.dimensao_cm as logo_dimensao_cm,
    opl.dimensao_tipo as logo_dimensao_tipo
  from public.sistema_producao_itens pi
  join public.sistema_pedidos p on p.id = pi.pedido_id
  join public.sistema_status s on s.slug = pi.status
  cross join lateral (
    select e.value as item, e.ord as posicao
    from jsonb_array_elements(p.itens) with ordinality e(value, ord)
    where (e.value ->> 'id')::uuid = pi.item_id
    limit 1
  ) it
  left join lateral (
    select l.conteudo, l.dimensao_cm, l.dimensao_tipo
      from public.sistema_op_terceirizada_links l
     where l.producao_item_id = pi.id
     order by l.criado_em desc
     limit 1
  ) opl on true
  where pi.terceirizada_id = public.terceirizada_id_atual()
    and public.terceirizada_id_atual() is not null
    and s.coluna_pcp in ('teste_fisico_terceirizada', 'teste_enviado', 'em_producao_terceirizada', 'inserir_medidas')
$$;

revoke all on function public.sistema_pcp_terceirizada() from public, anon;
grant execute on function public.sistema_pcp_terceirizada() to authenticated;
