-- =====================================================================
-- GIFT WEB - Fecha as regras "qualquer login lê/edita tudo" apontadas no
-- scan de segurança do Lovable. Desde que terceirizadas ganharam login de
-- verdade (auth.uid() válido, mas fora de admin_users), "TO authenticated
-- USING (true)" deixa uma conta de parceiro -- ou qualquer conta criada
-- pelo cadastro público -- ler leads, itens de pedido etc. via PostgREST.
--
-- NÃO mexe no que é público de propósito (catálogo do site: products_cache,
-- coleções, top produtos, vitrine, catalogo_clientes do link de WhatsApp)
-- nem em sistema_status (só rótulos, o painel da terceirizada usa).
--
-- Idempotente: apaga só as policies permissivas (qual/with_check = true)
-- que existirem de fato no banco, seja qual for o nome, e recria as certas.
-- =====================================================================

-- 1) Remove policies permissivas das tabelas internas. Em leads mantém o
--    INSERT anônimo (formulário de captura do site).
do $$
declare r record;
begin
  for r in
    select tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('leads', 'sync_log', 'sistema_fornecedores',
                         'sistema_calcme_itens', 'sistema_calcme_item_arquivos', 'sistema_calcme_sync_log')
       and (coalesce(qual, '') = 'true' or coalesce(with_check, '') = 'true')
       and not (tablename = 'leads' and cmd = 'INSERT')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- 2) Recria o acesso só pra equipe interna (is_admin_user = tem linha em
--    admin_users: admin, comercial e produção -- terceirizada não).
do $$
begin
  if to_regclass('public.leads') is not null then
    drop policy if exists "equipe interna le leads" on public.leads;
    create policy "equipe interna le leads" on public.leads
      for select to authenticated using (public.is_admin_user());
  end if;

  if to_regclass('public.sync_log') is not null then
    revoke all on public.sync_log from anon;
    drop policy if exists "equipe interna le sync_log" on public.sync_log;
    create policy "equipe interna le sync_log" on public.sync_log
      for select to authenticated using (public.is_admin_user());
  end if;

  if to_regclass('public.sistema_fornecedores') is not null then
    drop policy if exists "admin escreve fornecedores" on public.sistema_fornecedores;
    create policy "admin escreve fornecedores" on public.sistema_fornecedores
      for all to authenticated
      using (public.is_admin_user()) with check (public.is_admin_user());
  end if;

  if to_regclass('public.sistema_calcme_itens') is not null then
    revoke all on public.sistema_calcme_itens from anon;
    drop policy if exists "equipe interna calcme itens" on public.sistema_calcme_itens;
    create policy "equipe interna calcme itens" on public.sistema_calcme_itens
      for all to authenticated using (public.is_admin_user()) with check (public.is_admin_user());
  end if;

  if to_regclass('public.sistema_calcme_item_arquivos') is not null then
    revoke all on public.sistema_calcme_item_arquivos from anon;
    drop policy if exists "equipe interna calcme arquivos" on public.sistema_calcme_item_arquivos;
    create policy "equipe interna calcme arquivos" on public.sistema_calcme_item_arquivos
      for all to authenticated using (public.is_admin_user()) with check (public.is_admin_user());
  end if;

  if to_regclass('public.sistema_calcme_sync_log') is not null then
    revoke all on public.sistema_calcme_sync_log from anon;
    drop policy if exists "equipe interna calcme sync log" on public.sistema_calcme_sync_log;
    create policy "equipe interna calcme sync log" on public.sistema_calcme_sync_log
      for all to authenticated using (public.is_admin_user()) with check (public.is_admin_user());
  end if;
end $$;

-- 3) Chat do PCP: o UPDATE (marcar como lida) checava só a linha de ANTES
--    (with check true) -- dava pra "mover" uma mensagem pra item de outra
--    terceirizada. Agora a linha depois do update passa pela mesma regra.
drop policy if exists "marcam mensagens como lidas" on public.sistema_producao_comentarios;
create policy "marcam mensagens como lidas" on public.sistema_producao_comentarios
  for update to authenticated
  using (
    public.is_admin_user()
    or exists (
      select 1 from public.sistema_producao_itens pi
       where pi.id = producao_item_id
         and public.terceirizada_id_atual() is not null
         and pi.terceirizada_id = public.terceirizada_id_atual()
    )
  )
  with check (
    public.is_admin_user()
    or exists (
      select 1 from public.sistema_producao_itens pi
       where pi.id = producao_item_id
         and public.terceirizada_id_atual() is not null
         and pi.terceirizada_id = public.terceirizada_id_atual()
    )
  );

-- 4) Bucket site-images: continua público pra quem tem o link (URL pública
--    não passa por RLS), mas deixa de ser LISTÁVEL por qualquer um. A
--    equipe interna mantém leitura -- o upload com upsert das telas de
--    admin precisa dela.
drop policy if exists "public_read_site_images" on storage.objects;
drop policy if exists "equipe interna le site images" on storage.objects;
create policy "equipe interna le site images" on storage.objects
  for select to authenticated
  using (bucket_id = 'site-images' and public.is_admin_user());
