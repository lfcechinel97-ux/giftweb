-- =====================================================================
-- PCP: coluna "Produção Finalizada / Agrupamento" entre "A Produzir
-- (Galpão/Terceirizada)" e "Inserir Medidas".
-- Produção concluída espera aqui, agrupando os produtos do pedido, antes de
-- medir. Item terceirizado que termina ganha a tag COLETAR TERCEIRIZADA.
-- Vale também para o PCP da terceirizada (portal externo).
-- =====================================================================

alter table public.sistema_status drop constraint if exists sistema_status_coluna_pcp_check;
alter table public.sistema_status add constraint sistema_status_coluna_pcp_check
  check (coluna_pcp in (
    'organizando_pedido', 'organizando_comercial', 'pronto_producao', 'aguardando_mercadoria',
    'teste_fisico', 'teste_fisico_terceirizada', 'teste_enviado', 'preparacao',
    'em_producao', 'em_producao_terceirizada', 'producao_finalizada', 'produzido', 'inserir_medidas',
    'embalagem_pagamento', 'aguardando_coleta', 'enviado', 'cancelado'));

insert into public.sistema_status (slug, nome, cor, ordem, coluna_pcp, escopo, protegido)
values ('producao_finalizada', 'Produção finalizada / Agrupamento', '#A16207', 72, 'producao_finalizada', 'ambos', true)
on conflict (slug) do update
  set nome = excluded.nome, cor = excluded.cor, ordem = excluded.ordem,
      coluna_pcp = excluded.coluna_pcp, ativo = true;

-- Portal da terceirizada: mostra a nova coluna.
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
  logo_dimensao_tipo text,
  logo_link_id uuid,
  logo_expira_em timestamptz
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
    opl.dimensao_tipo as logo_dimensao_tipo,
    opl.id as logo_link_id,
    opl.expira_em as logo_expira_em
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
    select l.id, l.conteudo, l.dimensao_cm, l.dimensao_tipo, l.expira_em
      from public.sistema_op_terceirizada_links l
     where l.producao_item_id = pi.id
     order by l.criado_em desc
     limit 1
  ) opl on true
  where pi.terceirizada_id = public.terceirizada_id_atual()
    and public.terceirizada_id_atual() is not null
    and s.coluna_pcp in ('teste_fisico_terceirizada', 'teste_enviado', 'em_producao_terceirizada', 'producao_finalizada', 'inserir_medidas')
$$;
revoke all on function public.sistema_pcp_terceirizada() from public, anon;
grant execute on function public.sistema_pcp_terceirizada() to authenticated;

-- Terceirizada anexou a produção concluída: vai para Produção Finalizada
-- (não mais direto para Inserir Medidas) com COLETAR TERCEIRIZADA.
create or replace function public.sistema_terceirizada_anexar_producao(
  p_producao_id uuid, p_urls text[], p_tipos text[]
)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_terc uuid := public.terceirizada_id_atual();
  v_terc_nome text;
  v_coluna text;
  v_tags text[];
  v_pedido_id uuid;
  v_pagamento_nome text;
  v_tag_pagamento text;
  v_capa text;
  v_capa_tipo text;
  v_qtd int;
  i int;
begin
  if v_terc is null then raise exception 'Acesso negado'; end if;
  if p_urls is null or array_length(p_urls, 1) is null then raise exception 'Anexo invalido'; end if;

  select f.nome into v_terc_nome from public.sistema_fornecedores f where f.id = v_terc;

  select s.coluna_pcp, pi.tags, pi.pedido_id into v_coluna, v_tags, v_pedido_id
    from public.sistema_producao_itens pi
    join public.sistema_status s on s.slug = pi.status
   where pi.id = p_producao_id and pi.terceirizada_id = v_terc
   for update of pi;

  if not found then raise exception 'Item nao encontrado ou nao pertence a esta terceirizada'; end if;
  if v_coluna <> 'em_producao_terceirizada' then raise exception 'Item nao esta em producao'; end if;

  v_qtd := array_length(p_urls, 1);
  v_capa := null;
  for i in 1..v_qtd loop
    if coalesce(p_tipos[i], 'foto') = 'foto' and v_capa is null then v_capa := p_urls[i]; v_capa_tipo := 'foto'; end if;
    insert into public.sistema_producao_anexos (producao_item_id, pedido_id, categoria, tipo, url)
    values (p_producao_id, v_pedido_id, 'producao', coalesce(p_tipos[i], 'foto'), p_urls[i]);
  end loop;
  if v_capa is null then v_capa := p_urls[1]; v_capa_tipo := coalesce(p_tipos[1], 'foto'); end if;

  v_tags := array(
    select t from unnest(coalesce(v_tags, '{}'::text[])) t
     where t not in ('TESTE ENVIADO', 'TESTE REFEITO')
  );

  select mp.nome into v_pagamento_nome
    from public.sistema_pedidos p
    left join public.sistema_meios_pagamento mp on mp.id = p.pagamento_id
   where p.id = v_pedido_id;

  -- Mesma etiqueta de pagamento do PCP interno (PAGO 100% CARTÃO / PIX /
  -- BOLETO / TRANSFERÊNCIA, COBRAR 50% FALTA).
  v_tag_pagamento := case
    when v_pagamento_nome ilike '%cart%' or v_pagamento_nome ilike '%cr_dito%' then 'PAGO 100% CARTÃO'
    when v_pagamento_nome ilike '%pix%' and v_pagamento_nome ilike '%50%' then 'COBRAR 50% FALTA'
    when v_pagamento_nome ilike '%pix%' then 'PAGO 100% PIX'
    when v_pagamento_nome ilike '%boleto%' then 'PAGO 100% BOLETO'
    when v_pagamento_nome ilike '%transfer%' then 'PAGO 100% TRANSFERÊNCIA'
    else null
  end;
  if v_tag_pagamento is not null and not (v_tag_pagamento = any(v_tags)) then
    v_tags := v_tags || v_tag_pagamento;
  end if;
  -- Terminou na terceirizada: avisa que já pode buscar.
  if not ('COLETAR TERCEIRIZADA' = any(v_tags)) then
    v_tags := v_tags || 'COLETAR TERCEIRIZADA'::text;
  end if;

  update public.sistema_producao_itens
     set producao_anexo_url = v_capa,
         producao_anexo_tipo = v_capa_tipo,
         producao_anexo_em = now(),
         tags = v_tags,
         status = 'producao_finalizada'
   where id = p_producao_id;

  insert into public.sistema_producao_historico (producao_item_id, status_anterior, status_novo, observacao)
  values (
    p_producao_id, null, 'producao_finalizada',
    format('%s arquivo(s) da produção concluída anexado(s) pela terceirizada %s', v_qtd, coalesce(v_terc_nome, ''))
  );
end;
$fn$;
revoke all on function public.sistema_terceirizada_anexar_producao(uuid, text[], text[]) from public, anon;
grant execute on function public.sistema_terceirizada_anexar_producao(uuid, text[], text[]) to authenticated;

-- Terceirizada pode medir já na Produção Finalizada, se quiser.
create or replace function public.sistema_terceirizada_inserir_medidas(
  p_producao_id uuid, p_comprimento numeric, p_altura numeric, p_largura numeric,
  p_peso numeric, p_responsavel text
)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_terc uuid := public.terceirizada_id_atual();
  v_coluna text;
  v_payload jsonb;
begin
  if v_terc is null then raise exception 'Acesso negado'; end if;
  if coalesce(p_comprimento, 0) <= 0 or coalesce(p_altura, 0) <= 0
     or coalesce(p_largura, 0) <= 0 or coalesce(p_peso, 0) <= 0 then
    raise exception 'Preencha comprimento, altura, largura e peso';
  end if;
  if coalesce(trim(p_responsavel), '') = '' then
    raise exception 'Informe o responsável pela medição';
  end if;

  select s.coluna_pcp into v_coluna
    from public.sistema_producao_itens pi
    join public.sistema_status s on s.slug = pi.status
   where pi.id = p_producao_id and pi.terceirizada_id = v_terc
   for update of pi;

  if not found then raise exception 'Item nao encontrado ou nao pertence a esta terceirizada'; end if;
  if v_coluna not in ('inserir_medidas', 'producao_finalizada') then raise exception 'Item nao esta em Inserir Medidas'; end if;

  v_payload := jsonb_build_object(
    'responsavel', p_responsavel,
    'itens', jsonb_build_array(jsonb_build_object(
      'comprimento', p_comprimento, 'altura', p_altura, 'largura', p_largura, 'peso', p_peso
    ))
  );

  update public.sistema_producao_itens
     set volumes = v_payload,
         tags = array[format('1V %sX%sX%s / %sKG', p_comprimento, p_altura, p_largura, p_peso)],
         status = 'aguardando_coleta'
   where id = p_producao_id;

  insert into public.sistema_producao_historico (producao_item_id, status_anterior, status_novo, observacao)
  values (p_producao_id, null, 'aguardando_coleta', format('Expedição registrada pela terceirizada (%s)', p_responsavel));
end;
$fn$;


-- Etiquetas novas no catálogo (aparecem no "Adicionar etiqueta").
insert into public.sistema_etiquetas (nome, cor)
select v.nome, v.cor
from (values
  ('COLETAR TERCEIRIZADA', '#C2410C'),
  ('AGUARDANDO VETORIZAÇÃO', '#7C3AED'),
  ('AGUARDANDO CARTELA', '#0369A1')
) as v(nome, cor)
where not exists (select 1 from public.sistema_etiquetas e where e.nome_norm = lower(v.nome));
