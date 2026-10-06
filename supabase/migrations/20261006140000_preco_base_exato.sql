-- =====================================================================
-- GIFT WEB - preco_base com TODOS os dígitos.
--
-- Comparação produto a produto (14.547 produtos) mostrou que preco_base
-- como double precision chegava no site arredondado a 15 dígitos (ex.:
-- 1,2 x 6 = 7.199999999999999 no JS, mas a API devolvia 7.2) -- e isso
-- trocava 1 centavo em ~6 mil preços exibidos. As faixas customizadas
-- (preco_faixas) já batiam 100% porque vão como numeric com todos os
-- dígitos; aqui preco_base passa a ir do mesmo jeito.
-- =====================================================================

create or replace function public.preco_base_exato(p_custo double precision)
returns numeric
language sql immutable
set search_path = public
set extra_float_digits = 1
as $$
  select case when p_custo is null or p_custo <= 0 then null
              else ((p_custo * public.preco_markup(p_custo))::text)::numeric end;
$$;

alter table public.products_cache alter column preco_base type numeric using null;

create or replace function public.trg_preco_venda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_c float8;
begin
  v_c := new.preco_custo::float8;
  if v_c is null or v_c <= 0 then
    new.preco_base := null;
    new.preco_faixas := null;
  else
    new.preco_base := public.preco_base_exato(v_c);
    new.preco_faixas := public.preco_faixas_custom(v_c, new.tabela_precos);
  end if;
  return new;
end;
$$;

revoke execute on function public.preco_base_exato(double precision) from public, anon;

notify pgrst, 'reload schema';

-- Depois, preencher em lotes (rodar até dar 0 linhas):
-- with lote as (
--   select id from public.products_cache
--    where preco_base is null and preco_custo > 0
--    limit 2000
-- )
-- update public.products_cache pc
--    set preco_base = public.preco_base_exato(pc.preco_custo::float8)
--   from lote
--  where pc.id = lote.id;
