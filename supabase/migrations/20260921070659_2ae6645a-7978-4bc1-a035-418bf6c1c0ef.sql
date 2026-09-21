-- C2: fechar tabelas que qualquer conta logada podia ler/alterar
do $$
declare t text;
begin
  foreach t in array array[
    'sistema_producao_itens','sistema_producao_historico','sistema_pedido_itens',
    'sistema_item_historico','sistema_cotacoes_frete','sistema_fornecedores','sistema_tecnicas'
  ] loop
    execute format('drop policy if exists %I on public.%I', 'auth_all_'||t, t);
    execute format('drop policy if exists %I on public.%I', 'sistema_only', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.is_admin_user()) with check (public.is_admin_user())',
      'sistema_only', t);
  end loop;
end $$;

-- A1: views deixam de passar por cima do RLS
alter view public.vw_pcp              set (security_invoker = on);
alter view public.vw_fora_de_casa     set (security_invoker = on);
alter view public.vw_pendentes_compra set (security_invoker = on);

-- M1: objetos novos não nascem expostos ao anon
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;

-- M2: funções internas deixam de ser executáveis por anon/public
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'sistema_contar_pedidos_por_coluna','sistema_criar_producao_inicial',
        'sistema_registrar_mudanca_producao','sistema_registrar_mudanca_status',
        'trg_estoque_total','trg_estoque_total_after','sistema_comentario_preenche_autor'
      )
  loop
    execute format('revoke all on function %s from anon, public', r.sig);
  end loop;
end $$;

create or replace function public.sistema_contar_pedidos_por_coluna()
returns table(coluna_pcp text, total bigint)
language plpgsql stable security definer set search_path to 'public'
as $fn$
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;
  return query
    select s.coluna_pcp, count(*)::bigint
    from public.sistema_pedidos p
    join public.sistema_status s on s.slug = p.status
    group by s.coluna_pcp;
end;
$fn$;
revoke all on function public.sistema_contar_pedidos_por_coluna() from anon, public;
grant execute on function public.sistema_contar_pedidos_por_coluna() to authenticated;

-- M3: limpeza do products_cache
drop policy if exists "Public read access" on public.products_cache;
drop policy if exists "admin_write" on public.products_cache;
create policy "admin_write" on public.products_cache
  for update to authenticated using (public.is_admin_user()) with check (public.is_admin_user());