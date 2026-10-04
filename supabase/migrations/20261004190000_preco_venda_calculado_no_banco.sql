-- =====================================================================
-- GIFT WEB - Preço de venda calculado no banco (parte 1 de 2, só ADITIVA).
--
-- Hoje o site baixa preco_custo + tabela_precos de cada produto e aplica
-- a margem no navegador (src/utils/price.ts) -- qualquer visitante vê o
-- custo pelo F12. Aqui o banco passa a guardar, por produto, só o que o
-- site precisa pra mostrar exatamente os MESMOS preços:
--   preco_base   = custo x markup da faixa (= preço unitário sem desconto)
--   preco_faixas = tabela customizada já convertida em preço de venda
--                  [{qty, unit, desc}] (null = usa o desconto padrão)
--
-- Mesma aritmética do JS: tudo em float8 (IEEE double, igual ao Number do
-- JS), mesma ordem de operações, e os valores vão pro jsonb com todos os
-- dígitos (float8 -> text -> numeric), sem arredondar.
--
-- A parte 2 (outra migration, depois que o site novo estiver publicado)
-- é que tira o custo do alcance de visitantes anônimos.
-- =====================================================================

create or replace function public.preco_markup(p_custo double precision)
returns double precision
language sql immutable
set search_path = public
as $$
  select case
    when p_custo <= 1.0 then 6.0::float8
    when p_custo <= 3.0 then 4.8::float8
    when p_custo <= 8.0 then 3.8::float8
    when p_custo <= 15.0 then 3.0::float8
    when p_custo <= 25.0 then 2.5::float8
    when p_custo <= 40.0 then 2.1::float8
    when p_custo <= 70.0 then 1.8::float8
    else 1.6::float8
  end;
$$;

-- Espelho do toNum() do JS: número; ou string com a 1ª vírgula trocada por
-- ponto e o prefixo numérico (parseFloat); qualquer outra coisa = null.
create or replace function public.preco_to_num(v jsonb)
returns double precision
language plpgsql immutable
set search_path = public
as $$
declare s text; m text;
begin
  if v is null then return null; end if;
  if jsonb_typeof(v) = 'number' then return (v #>> '{}')::float8; end if;
  if jsonb_typeof(v) <> 'string' then return null; end if;
  s := regexp_replace(v #>> '{}', ',', '.');
  m := substring(s from '^\s*([+-]?([0-9]+\.?[0-9]*|\.[0-9]+)([eE][+-]?[0-9]+)?)');
  if m is null then return null; end if;
  return m::float8;
exception when others then
  return null;
end;
$$;

-- Espelho de getNormalizedPriceRows() (só a parte que vira dado: qty, unit
-- e desc; descVsFirst é derivado no navegador como antes).
create or replace function public.preco_faixas_custom(p_custo double precision, p_tabela jsonb)
returns jsonb
language plpgsql immutable
set search_path = public
set extra_float_digits = 1
as $$
declare
  v_markup float8;
  r jsonb;
  v_ord bigint;
  v_qv jsonb;
  v_qty float8;
  v_row_qty float8;
  v_mult float8;
  v_desc float8;
  v_unit float8;
  v_txt text;
  v_rows jsonb := '[]'::jsonb;
  v_lista jsonb := '[]'::jsonb;
begin
  if p_custo is null or p_custo <= 0 then return null; end if;
  if p_tabela is null or jsonb_typeof(p_tabela) <> 'array' or jsonb_array_length(p_tabela) = 0 then return null; end if;
  v_markup := public.preco_markup(p_custo);

  for r, v_ord in select e, o from jsonb_array_elements(p_tabela) with ordinality as t(e, o) loop
    if jsonb_typeof(r) <> 'object' then continue; end if;

    -- qtyRaw = r.qty ?? r.quantidade
    v_qv := case when r->'qty' is null or jsonb_typeof(r->'qty') = 'null' then r->'quantidade' else r->'qty' end;
    if v_qv is not null and jsonb_typeof(v_qv) = 'number' then
      v_qty := (v_qv #>> '{}')::float8;
    elsif v_qv is not null and jsonb_typeof(v_qv) = 'string' then
      -- parseInt(String(x), 10)
      v_txt := substring(v_qv #>> '{}' from '^\s*([+-]?[0-9]+)');
      v_qty := case when v_txt is null then null else v_txt::float8 end;
    else
      v_qty := null;
    end if;
    if v_qty is null or v_qty <= 0 or v_qty = 'Infinity'::float8 then continue; end if;

    -- getCustomMultiplier([r], custo, qty)
    v_row_qty := public.preco_to_num(v_qv);
    if v_row_qty is null or v_row_qty <> v_qty then continue; end if;
    v_mult := public.preco_to_num(r->'multiplicador');
    if not (v_mult is not null and v_mult > 0) then
      v_desc := public.preco_to_num(r->'desconto');
      if v_desc is null then continue; end if;
      v_mult := v_markup * (1::float8 - v_desc);
      if not (v_mult > 0) then continue; end if;
    end if;
    if v_mult = 'Infinity'::float8 then continue; end if;

    v_unit := p_custo * v_mult;
    if v_unit is null or v_unit <= 0 or v_unit = 'Infinity'::float8 then continue; end if;

    v_lista := v_lista || jsonb_build_array(jsonb_build_object(
      'qty', (v_qty::text)::numeric,
      'unit', (v_unit::text)::numeric,
      'desc', (greatest(0::float8, 1::float8 - v_mult / v_markup)::text)::numeric,
      '_o', v_ord
    ));
  end loop;

  if jsonb_array_length(v_lista) = 0 then return null; end if;

  -- sort estável por qty (igual ao Array.sort do JS)
  select jsonb_agg(x - '_o' order by (x->>'qty')::numeric, (x->>'_o')::bigint)
    into v_rows
    from jsonb_array_elements(v_lista) as x;
  return v_rows;
end;
$$;

alter table public.products_cache add column if not exists preco_base double precision;
alter table public.products_cache add column if not exists preco_faixas jsonb;

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
    new.preco_base := v_c * public.preco_markup(v_c);
    new.preco_faixas := public.preco_faixas_custom(v_c, new.tabela_precos);
  end if;
  return new;
end;
$$;

drop trigger if exists preco_venda_before on public.products_cache;
create trigger preco_venda_before
  before insert or update of preco_custo, tabela_precos
  on public.products_cache
  for each row execute function public.trg_preco_venda();

-- Backfill (não dispara os gatilhos de estoque: eles só olham estoque,
-- produto_pai e is_variante).
update public.products_cache
   set preco_base = case when preco_custo is null or preco_custo <= 0 then null
                         else preco_custo::float8 * public.preco_markup(preco_custo::float8) end,
       preco_faixas = case when preco_custo is null or preco_custo <= 0 then null
                           else public.preco_faixas_custom(preco_custo::float8, tabela_precos) end;

-- Helpers não são API pública (a tabela de margem não deve ser sondável).
revoke execute on function public.preco_markup(double precision) from public, anon;
revoke execute on function public.preco_to_num(jsonb) from public, anon;
revoke execute on function public.preco_faixas_custom(double precision, jsonb) from public, anon;
revoke execute on function public.trg_preco_venda() from public, anon;

notify pgrst, 'reload schema';
