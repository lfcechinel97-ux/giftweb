-- =====================================================================
-- GIFT WEB - Dashboard de terceirizada (/pcp/terceirizada)
--
-- Login proprio (usuario+senha, sem precisar ser e-mail de verdade) pra
-- cada parceiro terceirizado (comeca com a FLEX) ver e mexer SOMENTE nos
-- proprios produtos, nas 3 colunas que importam pra producao externa:
--   teste_fisico_terceirizada / em_producao_terceirizada / inserir_medidas
--
-- Decisao de design: nao expor sistema_producao_itens/sistema_pedidos
-- direto pra esse papel (teria que dar SELECT/UPDATE por RLS, e qualquer
-- policy nova nessas tabelas e superficie de ataque pro resto do sistema,
-- que hoje assume "authenticated = admin"). Em vez disso, tudo passa por
-- funcoes SECURITY DEFINER bem estreitas (mesmo padrao ja usado em
-- sistema_op_terceirizada_publica): leitura devolve só as colunas que a
-- terceirizada pode ver (sem cliente, sem preço, sem vendedor), e cada
-- escrita e uma acao especifica (anexar teste / anexar producao / inserir
-- medidas), nunca um UPDATE livre.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Login da terceirizada: usuario+senha vira e-mail sintetico no
--    auth.users (criado manualmente pelo admin via Supabase Studio),
--    e essa tabela só faz o vinculo auth_user_id -> terceirizada_id.
-- ---------------------------------------------------------------------
create table if not exists public.sistema_terceirizada_usuarios (
  id uuid primary key default gen_random_uuid(),
  usuario text not null unique,
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  terceirizada_id uuid not null references public.sistema_fornecedores(id),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.sistema_terceirizada_usuarios enable row level security;

drop policy if exists "admin gerencia terceirizada usuarios" on public.sistema_terceirizada_usuarios;
create policy "admin gerencia terceirizada usuarios" on public.sistema_terceirizada_usuarios
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- A própria terceirizada precisa ler seu vínculo pra saber quem ela é
-- (nome exibido no topo do dashboard) sem precisar ser admin.
drop policy if exists "terceirizada le o proprio vinculo" on public.sistema_terceirizada_usuarios;
create policy "terceirizada le o proprio vinculo" on public.sistema_terceirizada_usuarios
  for select to authenticated
  using (auth_user_id = auth.uid());

revoke all on public.sistema_terceirizada_usuarios from anon;
grant select, insert, update, delete on public.sistema_terceirizada_usuarios to authenticated;

-- ---------------------------------------------------------------------
-- 2) Helper: terceirizada_id do usuario logado agora, ou null se este
--    login nao e de uma terceirizada (admin, vendedor, etc).
-- ---------------------------------------------------------------------
create or replace function public.terceirizada_id_atual()
returns uuid
language sql stable security definer set search_path = public as $$
  select terceirizada_id
    from public.sistema_terceirizada_usuarios
   where auth_user_id = auth.uid() and ativo
   limit 1
$$;

revoke all on function public.terceirizada_id_atual() from public, anon;
grant execute on function public.terceirizada_id_atual() to authenticated;

-- Identidade pra mostrar no topo do dashboard (nome de exibicao, nao o
-- usuario de login).
create or replace function public.sistema_terceirizada_meu_perfil()
returns table(usuario text, terceirizada_nome text)
language sql stable security definer set search_path = public as $$
  select u.usuario, f.nome
    from public.sistema_terceirizada_usuarios u
    join public.sistema_fornecedores f on f.id = u.terceirizada_id
   where u.auth_user_id = auth.uid() and u.ativo
$$;

revoke all on function public.sistema_terceirizada_meu_perfil() from public, anon;
grant execute on function public.sistema_terceirizada_meu_perfil() to authenticated;

-- ---------------------------------------------------------------------
-- 3) Leitura: as 3 colunas, só os itens desta terceirizada, só os
--    campos que ela pode ver (sem cliente, preço ou vendedor -- mesmo
--    espirito do snapshot de sistema_op_terceirizada_publica).
-- ---------------------------------------------------------------------
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
  observacao text,
  tags text[],
  teste_anexo_url text,
  producao_anexo_url text,
  producao_anexo_tipo text,
  volumes jsonb,
  item_posicao int,
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
    it.item ->> 'observacao' as observacao,
    pi.tags,
    pi.teste_anexo_url,
    pi.producao_anexo_url,
    pi.producao_anexo_tipo,
    pi.volumes,
    it.posicao::int as item_posicao,
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

-- ---------------------------------------------------------------------
-- 3b) SELECT direto (restrito) em sistema_producao_itens -- SÓ pra dar
--     acesso ao Realtime (postgres_changes avalia RLS na tabela base; sem
--     uma policy aqui o canal nunca entrega evento nenhum pra esse login).
--     Esta tabela não tem cliente/preço (isso mora em sistema_pedidos,
--     que a terceirizada não ganha policy nenhuma aqui), então é segura
--     de expor de forma restrita. Escrita continua só pelas funções acima.
-- ---------------------------------------------------------------------
drop policy if exists "terceirizada le os proprios itens" on public.sistema_producao_itens;
create policy "terceirizada le os proprios itens" on public.sistema_producao_itens
  for select to authenticated
  using (
    terceirizada_id = public.terceirizada_id_atual()
    and public.terceirizada_id_atual() is not null
    and status in (
      select slug from public.sistema_status
       where coluna_pcp in ('teste_fisico_terceirizada', 'em_producao_terceirizada', 'inserir_medidas')
    )
  );

-- ---------------------------------------------------------------------
-- 4a) Anexar teste físico -- espelha handleAnexoTeste do PCP interno:
--     TESTE ENVIADO (ou TESTE REFEITO se já tinha sido recusado antes),
--     sai da coluna assim que anexa (vai pra "Teste Enviado", que é
--     fora das 3 colunas da terceirizada -- some da tela dela até o
--     vendedor aprovar/recusar com o cliente).
-- ---------------------------------------------------------------------
create or replace function public.sistema_terceirizada_anexar_teste(p_producao_id uuid, p_url text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_terc uuid := public.terceirizada_id_atual();
  v_coluna text;
  v_tags text[];
  v_nova_tag text;
begin
  if v_terc is null then raise exception 'Acesso negado'; end if;
  if coalesce(trim(p_url), '') = '' then raise exception 'Anexo invalido'; end if;

  select s.coluna_pcp, pi.tags into v_coluna, v_tags
    from public.sistema_producao_itens pi
    join public.sistema_status s on s.slug = pi.status
   where pi.id = p_producao_id and pi.terceirizada_id = v_terc
   for update of pi;

  if not found then raise exception 'Item nao encontrado ou nao pertence a esta terceirizada'; end if;
  if v_coluna <> 'teste_fisico_terceirizada' then raise exception 'Item nao esta aguardando teste'; end if;

  v_nova_tag := case when 'TESTE RECUSADO' = any(coalesce(v_tags, '{}'::text[]))
    then 'TESTE REFEITO' else 'TESTE ENVIADO' end;
  v_tags := array(
    select t from unnest(coalesce(v_tags, '{}'::text[])) t
     where t not in ('TESTE ENVIADO', 'TESTE REFEITO', 'TESTE RECUSADO', 'TESTE APROVADO')
  ) || v_nova_tag;

  update public.sistema_producao_itens
     set teste_anexo_url = p_url,
         teste_enviado_em = now(),
         tags = v_tags,
         status = 'aguardando_aprovacao_teste'
   where id = p_producao_id;

  insert into public.sistema_producao_historico (producao_item_id, status_anterior, status_novo, observacao)
  values (p_producao_id, null, 'aguardando_aprovacao_teste', 'Teste físico anexado pela terceirizada');
end;
$fn$;

revoke all on function public.sistema_terceirizada_anexar_teste(uuid, text) from public, anon;
grant execute on function public.sistema_terceirizada_anexar_teste(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4b) Anexar produção concluída (foto/vídeo) -- espelha
--     handleAnexoProducao: some a tag de teste enviado/refeito (já
--     cumpriu o papel), aplica tag de pagamento se for o caso, e manda
--     direto pra Inserir Medidas (sem popup, igual o fluxo interno).
-- ---------------------------------------------------------------------
create or replace function public.sistema_terceirizada_anexar_producao(
  p_producao_id uuid, p_url text, p_tipo text
)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_terc uuid := public.terceirizada_id_atual();
  v_coluna text;
  v_tags text[];
  v_pedido_id uuid;
  v_pagamento_nome text;
  v_tag_pagamento text;
begin
  if v_terc is null then raise exception 'Acesso negado'; end if;
  if p_tipo not in ('foto', 'video') then raise exception 'Tipo de anexo invalido'; end if;
  if coalesce(trim(p_url), '') = '' then raise exception 'Anexo invalido'; end if;

  select s.coluna_pcp, pi.tags, pi.pedido_id into v_coluna, v_tags, v_pedido_id
    from public.sistema_producao_itens pi
    join public.sistema_status s on s.slug = pi.status
   where pi.id = p_producao_id and pi.terceirizada_id = v_terc
   for update of pi;

  if not found then raise exception 'Item nao encontrado ou nao pertence a esta terceirizada'; end if;
  if v_coluna <> 'em_producao_terceirizada' then raise exception 'Item nao esta em producao'; end if;

  v_tags := array(
    select t from unnest(coalesce(v_tags, '{}'::text[])) t
     where t not in ('TESTE ENVIADO', 'TESTE REFEITO')
  );

  -- Heurística simplificada da regra interna (isPagamentoCartao/Pix): só
  -- sinaliza cartão ou "cobrar 50% restante" pelo nome do meio de
  -- pagamento; não cobre todos os casos que o fluxo interno cobre.
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
     set producao_anexo_url = p_url,
         producao_anexo_tipo = p_tipo,
         producao_anexo_em = now(),
         tags = v_tags,
         status = 'inserir_medidas'
   where id = p_producao_id;

  insert into public.sistema_producao_historico (producao_item_id, status_anterior, status_novo, observacao)
  values (
    p_producao_id, null, 'inserir_medidas',
    format('%s da produção concluída anexado pela terceirizada', case when p_tipo = 'video' then 'Vídeo' else 'Foto' end)
  );
end;
$fn$;

revoke all on function public.sistema_terceirizada_anexar_producao(uuid, text, text) from public, anon;
grant execute on function public.sistema_terceirizada_anexar_producao(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 4c) Inserir medidas (1 volume) -- espelha aplicarVolumesNoItem: grava
--     volumes, vira tag "1V CxAxL / PKG" (mesmo padrão do PCP interno,
--     limitado a uma caixa por item nesta v1) e manda pra Expedição.
-- ---------------------------------------------------------------------
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
  if v_coluna <> 'inserir_medidas' then raise exception 'Item nao esta em Inserir Medidas'; end if;

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

revoke all on function public.sistema_terceirizada_inserir_medidas(uuid, numeric, numeric, numeric, numeric, text) from public, anon;
grant execute on function public.sistema_terceirizada_inserir_medidas(uuid, numeric, numeric, numeric, numeric, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5) Storage: a terceirizada só pode enviar arquivo pra PASTA do PRÓPRIO
--    item (pcp/teste/<producao_id>/... ou pcp/producao/<producao_id>/...),
--    nunca em qualquer outro caminho do bucket.
-- ---------------------------------------------------------------------
drop policy if exists "terceirizada anexa teste ou producao dos proprios itens" on storage.objects;
create policy "terceirizada anexa teste ou producao dos proprios itens" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'mockups'
    and public.terceirizada_id_atual() is not null
    and (name like 'pcp/teste/%' or name like 'pcp/producao/%')
    and exists (
      select 1 from public.sistema_producao_itens pi
       where pi.id = (split_part(name, '/', 3))::uuid
         and pi.terceirizada_id = public.terceirizada_id_atual()
    )
  );
