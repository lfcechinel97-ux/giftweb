-- =====================================================================
-- GIFT WEB - Preço de custo fora do alcance do público (parte 2 de 2).
-- Rodar SÓ depois que o site novo (que lê preco_base/preco_faixas) estiver
-- publicado -- o site antigo ainda pede preco_custo e quebraria.
--
-- 1) Visitante anônimo deixa de poder ler preco_custo, tabela_precos e
--    preco_custo_manual (permissão por coluna). Equipe logada não muda.
-- 2) As buscas públicas do catálogo (security definer, devolviam pc.*
--    com o custo junto) passam por um invólucro que tira essas chaves do
--    JSON. A função original é só renomeada pra *_interno -- o filtro, a
--    ordenação e a paginação continuam exatamente os mesmos.
-- 3) Versões antigas dessas buscas (sem filtro de preço) são removidas --
--    também devolviam o custo e o site não depende delas.
-- 4) calc_display_price (margem) deixa de ser chamável por anônimo.
-- =====================================================================

-- 1) Permissão por coluna pro anônimo.
do $$
declare v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'products_cache'
     and column_name not in ('preco_custo', 'tabela_precos', 'preco_custo_manual');
  execute 'revoke select on public.products_cache from anon';
  execute format('grant select (%s) on public.products_cache to anon', v_cols);
end $$;

-- 2/3) Buscas públicas.
create or replace function public.produtos_sem_custo(p_resultado json)
returns json
language sql immutable
set search_path = public
as $$
  select json_build_object(
    'rows', coalesce((
      select json_agg((r - 'preco_custo' - 'tabela_precos' - 'preco_custo_manual') order by o)
        from jsonb_array_elements(coalesce(p_resultado::jsonb -> 'rows', '[]'::jsonb)) with ordinality as t(r, o)
    ), '[]'::json),
    'total_count', p_resultado -> 'total_count'
  );
$$;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as assinatura, p.proname,
           coalesce('p_preco_min' = any(p.proargnames), false) as tem_preco
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('search_products_global', 'search_products_by_category', 'search_products_by_collection')
  loop
    if f.tem_preco then
      execute format('alter function %s rename to %I', f.assinatura, f.proname || '_interno');
    else
      execute format('drop function %s', f.assinatura);
    end if;
  end loop;
end $$;

revoke execute on function public.search_products_global_interno(text[], text, boolean, text, integer, integer, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.search_products_by_category_interno(text, text[], text, boolean, text, integer, integer, numeric, numeric) from public, anon, authenticated;
revoke execute on function public.search_products_by_collection_interno(text, text[], text, boolean, text, integer, integer, numeric, numeric) from public, anon, authenticated;

create or replace function public.search_products_global(
  p_cor text[] default null, p_search text default null, p_apenas_estoque boolean default false,
  p_sort text default 'relevancia', p_page integer default 1, p_page_size integer default 20,
  p_preco_min numeric default null, p_preco_max numeric default null
) returns json
language sql stable security definer
set search_path = public
as $$
  select public.produtos_sem_custo(public.search_products_global_interno(
    p_cor, p_search, p_apenas_estoque, p_sort, p_page, p_page_size, p_preco_min, p_preco_max));
$$;

create or replace function public.search_products_by_category(
  p_category_slug text, p_cor text[] default null, p_search text default null, p_apenas_estoque boolean default false,
  p_sort text default 'relevancia', p_page integer default 1, p_page_size integer default 20,
  p_preco_min numeric default null, p_preco_max numeric default null
) returns json
language sql stable security definer
set search_path = public
as $$
  select public.produtos_sem_custo(public.search_products_by_category_interno(
    p_category_slug, p_cor, p_search, p_apenas_estoque, p_sort, p_page, p_page_size, p_preco_min, p_preco_max));
$$;

create or replace function public.search_products_by_collection(
  p_collection_slug text, p_cor text[] default null, p_search text default null, p_apenas_estoque boolean default false,
  p_sort text default 'relevancia', p_page integer default 1, p_page_size integer default 20,
  p_preco_min numeric default null, p_preco_max numeric default null
) returns json
language sql stable security definer
set search_path = public
as $$
  select public.produtos_sem_custo(public.search_products_by_collection_interno(
    p_collection_slug, p_cor, p_search, p_apenas_estoque, p_sort, p_page, p_page_size, p_preco_min, p_preco_max));
$$;

grant execute on function public.search_products_global(text[], text, boolean, text, integer, integer, numeric, numeric) to anon, authenticated, service_role;
grant execute on function public.search_products_by_category(text, text[], text, boolean, text, integer, integer, numeric, numeric) to anon, authenticated, service_role;
grant execute on function public.search_products_by_collection(text, text[], text, boolean, text, integer, integer, numeric, numeric) to anon, authenticated, service_role;

-- 4) Margem não sondável.
revoke execute on function public.calc_display_price(numeric) from public, anon;

notify pgrst, 'reload schema';
