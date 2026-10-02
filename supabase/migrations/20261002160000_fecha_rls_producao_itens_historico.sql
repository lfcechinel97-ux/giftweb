-- =====================================================================
-- GIFT WEB - Fecha uma brecha de segurança real: sistema_producao_itens e
-- sistema_producao_historico (migration histórica 08_fix_producao_satelite,
-- fora do controle do CLI) tinham policy "auth_all_<tabela>" USING (true)
-- FOR ALL -- ou seja, qualquer login autenticado podia ler/editar/apagar
-- QUALQUER linha de QUALQUER produto do sistema inteiro, não só os seus.
--
-- Isso nunca foi explorável de fato enquanto só existiam contas internas
-- (todas com acesso total mesmo). Agora que terceirizadas externas têm
-- login de verdade (auth.uid() válido, mas sem estar em admin_users),
-- essa policy antiga permitiria que um login de terceirizada burlasse
-- TODAS as funções SECURITY DEFINER estreitas criadas pra ela, lendo e
-- escrevendo direto na tabela via PostgREST.
--
-- O DROP é seguro mesmo que a policy não exista de fato no banco (IF
-- EXISTS) -- a migration 08 mora fora de supabase/migrations e uma
-- migration posterior já registrou incerteza se foi aplicada por inteiro.
--
-- Acesso de equipe interna (admin/vendedor/produção) continua igual:
-- is_admin_user() hoje cobre qualquer conta com linha em admin_users,
-- que é toda conta interna, não só papel "admin" (mesmo padrão usado em
-- sistema_producao_anexos e companhia).
-- =====================================================================

drop policy if exists "auth_all_sistema_producao_itens" on public.sistema_producao_itens;
drop policy if exists "auth_all_sistema_producao_historico" on public.sistema_producao_historico;

drop policy if exists "equipe interna acessa producao itens" on public.sistema_producao_itens;
create policy "equipe interna acessa producao itens" on public.sistema_producao_itens
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

alter table public.sistema_producao_historico enable row level security;

drop policy if exists "equipe interna acessa historico" on public.sistema_producao_historico;
create policy "equipe interna acessa historico" on public.sistema_producao_historico
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

-- Terceirizada lê o histórico só dos próprios itens (precisa pro painel
-- de detalhe dela mostrar "quem fez o quê" -- não escreve direto nunca,
-- as funções SECURITY DEFINER já inserem linha de histórico sozinhas).
drop policy if exists "terceirizada le historico dos proprios itens" on public.sistema_producao_historico;
create policy "terceirizada le historico dos proprios itens" on public.sistema_producao_historico
  for select to authenticated
  using (
    exists (
      select 1 from public.sistema_producao_itens pi
       where pi.id = producao_item_id
         and public.terceirizada_id_atual() is not null
         and pi.terceirizada_id = public.terceirizada_id_atual()
    )
  );

revoke all on public.sistema_producao_itens, public.sistema_producao_historico from anon;
grant select, insert, update, delete on public.sistema_producao_itens to authenticated;
grant select, insert, update, delete on public.sistema_producao_historico to authenticated;

-- Mesma brecha potencial em sistema_fornecedores: a migration
-- 20260930130000 já criou "admin escreve fornecedores", mas políticas
-- permissivas se somam por OR -- se "auth_all_sistema_fornecedores"
-- (outra migration histórica) ainda existisse, a mais nova não
-- restringiria nada de verdade. Terceirizada só devia ler, nunca escrever.
drop policy if exists "auth_all_sistema_fornecedores" on public.sistema_fornecedores;

-- ---------------------------------------------------------------------
-- As 3 funções de escrita da terceirizada gravavam histórico sem
-- usuario_id/vendedor_id (a terceirizada não está em admin_users, então
-- não tem como "nomePorUsuarioId" resolver nada) -- ficava sempre "não
-- identificado". Agora a observação já cita o nome da terceirizada.
-- ---------------------------------------------------------------------
create or replace function public.sistema_terceirizada_anexar_teste(p_producao_id uuid, p_url text)
returns void
language plpgsql security definer set search_path = public as $fn$
declare
  v_terc uuid := public.terceirizada_id_atual();
  v_terc_nome text;
  v_coluna text;
  v_tags text[];
  v_nova_tag text;
begin
  if v_terc is null then raise exception 'Acesso negado'; end if;
  if coalesce(trim(p_url), '') = '' then raise exception 'Anexo invalido'; end if;

  select f.nome into v_terc_nome from public.sistema_fornecedores f where f.id = v_terc;

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
  values (p_producao_id, null, 'aguardando_aprovacao_teste', format('Teste físico anexado pela terceirizada %s', coalesce(v_terc_nome, '')));
end;
$fn$;

create or replace function public.sistema_terceirizada_anexar_producao(
  p_producao_id uuid, p_url text, p_tipo text
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
begin
  if v_terc is null then raise exception 'Acesso negado'; end if;
  if p_tipo not in ('foto', 'video') then raise exception 'Tipo de anexo invalido'; end if;
  if coalesce(trim(p_url), '') = '' then raise exception 'Anexo invalido'; end if;

  select f.nome into v_terc_nome from public.sistema_fornecedores f where f.id = v_terc;

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
    format('%s da produção concluída anexado pela terceirizada %s', case when p_tipo = 'video' then 'Vídeo' else 'Foto' end, coalesce(v_terc_nome, ''))
  );
end;
$fn$;

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
