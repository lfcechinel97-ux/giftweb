-- =====================================================================
-- GIFT WEB - Anexar teste/produção (terceirizada) aceita vários arquivos
-- de uma vez (foto e vídeo misturados). A tabela sistema_producao_anexos
-- já suporta múltiplos arquivos por categoria (usada há tempo pela seção
-- "Anexos do PCP"); essas funções só gravavam 1 arquivo porque recebiam
-- 1 url só. Agora recebem arrays: todo arquivo entra em
-- sistema_producao_anexos (aparece completo no popup de detalhe), e
-- teste_anexo_url/producao_anexo_url (o que mostra pequeno do lado do
-- mockup no card) vira a primeira FOTO do lote (vídeo nunca vira capa).
--
-- Precisa DROP porque a assinatura muda (text -> text[], text[]).
-- =====================================================================

drop function if exists public.sistema_terceirizada_anexar_teste(uuid, text);
drop function if exists public.sistema_terceirizada_anexar_producao(uuid, text, text);

create or replace function public.sistema_terceirizada_anexar_teste(
  p_producao_id uuid, p_urls text[], p_tipos text[]
)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_terc uuid := public.terceirizada_id_atual();
  v_terc_nome text;
  v_pedido_id uuid;
  v_coluna text;
  v_tags text[];
  v_nova_tag text;
  v_capa text;
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
  if v_coluna <> 'teste_fisico_terceirizada' then raise exception 'Item nao esta aguardando teste'; end if;

  v_qtd := array_length(p_urls, 1);
  v_capa := null;
  for i in 1..v_qtd loop
    if coalesce(p_tipos[i], 'foto') = 'foto' and v_capa is null then v_capa := p_urls[i]; end if;
    insert into public.sistema_producao_anexos (producao_item_id, pedido_id, categoria, tipo, url)
    values (p_producao_id, v_pedido_id, 'teste', coalesce(p_tipos[i], 'foto'), p_urls[i]);
  end loop;
  if v_capa is null then v_capa := p_urls[1]; end if;

  v_nova_tag := case when 'TESTE RECUSADO' = any(coalesce(v_tags, '{}'::text[]))
    then 'TESTE REFEITO' else 'TESTE ENVIADO' end;
  v_tags := array(
    select t from unnest(coalesce(v_tags, '{}'::text[])) t
     where t not in ('TESTE ENVIADO', 'TESTE REFEITO', 'TESTE RECUSADO', 'TESTE APROVADO')
  ) || v_nova_tag;

  update public.sistema_producao_itens
     set teste_anexo_url = v_capa,
         teste_enviado_em = now(),
         tags = v_tags,
         status = 'aguardando_aprovacao_teste'
   where id = p_producao_id;

  insert into public.sistema_producao_historico (producao_item_id, status_anterior, status_novo, observacao)
  values (
    p_producao_id, null, 'aguardando_aprovacao_teste',
    format('%s arquivo(s) de teste físico anexado(s) pela terceirizada %s', v_qtd, coalesce(v_terc_nome, ''))
  );
end;
$fn$;

revoke all on function public.sistema_terceirizada_anexar_teste(uuid, text[], text[]) from public, anon;
grant execute on function public.sistema_terceirizada_anexar_teste(uuid, text[], text[]) to authenticated;

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

  v_tag_pagamento := case
    when v_pagamento_nome ilike '%cart%' then 'PAGO CARTÃO'
    when v_pagamento_nome ilike '%pix%' and v_pagamento_nome ilike '%50%' then 'COBRAR 50% RESTANTE'
    else null
  end;
  if v_tag_pagamento is not null and not (v_tag_pagamento = any(v_tags)) then
    v_tags := v_tags || v_tag_pagamento;
  end if;

  update public.sistema_producao_itens
     set producao_anexo_url = v_capa,
         producao_anexo_tipo = v_capa_tipo,
         producao_anexo_em = now(),
         tags = v_tags,
         status = 'inserir_medidas'
   where id = p_producao_id;

  insert into public.sistema_producao_historico (producao_item_id, status_anterior, status_novo, observacao)
  values (
    p_producao_id, null, 'inserir_medidas',
    format('%s arquivo(s) da produção concluída anexado(s) pela terceirizada %s', v_qtd, coalesce(v_terc_nome, ''))
  );
end;
$fn$;

revoke all on function public.sistema_terceirizada_anexar_producao(uuid, text[], text[]) from public, anon;
grant execute on function public.sistema_terceirizada_anexar_producao(uuid, text[], text[]) to authenticated;

-- Terceirizada lê (só leitura) os anexos dos próprios itens -- precisa
-- pro popup de detalhe dela listar TODOS os arquivos de teste/produção
-- já enviados, não só a capa que vai no card.
drop policy if exists "terceirizada le anexos dos proprios itens" on public.sistema_producao_anexos;
create policy "terceirizada le anexos dos proprios itens" on public.sistema_producao_anexos
  for select to authenticated
  using (
    exists (
      select 1 from public.sistema_producao_itens pi
       where pi.id = producao_item_id
         and public.terceirizada_id_atual() is not null
         and pi.terceirizada_id = public.terceirizada_id_atual()
    )
  );
