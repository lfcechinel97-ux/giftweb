-- =====================================================================
-- GIFT WEB - 1) Dado interno da empresa (custo, despesa, aluguel,
-- salário, imposto, margem) passa a exigir papel ADMIN de verdade, não
-- só "estar no sistema". As RPCs do financeiro são SECURITY INVOKER,
-- então travar as tabelas já tranca o dashboard financeiro e o fluxo de
-- vendas para quem não é admin.
--
-- 2) Painel do COMERCIAL: uma RPC que devolve apenas os números das
-- vendas do próprio vendedor, já com imposto e taxa de cartão
-- descontados — sem expor os percentuais em si.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'sistema_financeiro_config',
    'sistema_calcme_vendas',
    'sistema_calcme_venda_itens',
    'sistema_custo_produto',
    'sistema_despesa_categorias',
    'sistema_orcamento',
    'sistema_despesas',
    'sistema_recebimentos',
    'sistema_financeiro_sync_log'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format(
      'create policy "somente admin" on public.%I for all to authenticated '
      'using (public.has_role(auth.uid(), ''admin'')) '
      'with check (public.has_role(auth.uid(), ''admin''))', t);
  end loop;
end $$;

-- As views de resultado rodam como dono (postgres) e passariam por cima
-- do RLS das tabelas acima; security_invoker faz valer o papel de quem lê.
do $$
begin
  execute 'alter view public.sistema_venda_resultado set (security_invoker = on)';
  execute 'alter view public.sistema_venda_item_resultado set (security_invoker = on)';
exception when others then null;  -- Postgres < 15 não conhece a opção
end $$;

-- ---------------------------------------------------------------------
-- Painel do comercial
-- ---------------------------------------------------------------------
create or replace function public.sistema_dashboard_comercial(
  p_inicio date default null,
  p_fim    date default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ini date;
  v_fim date;
  v_vendedor uuid;
  v_todos boolean;
  v_imposto numeric;
  v_taxa_padrao numeric;
  v_json json;
begin
  v_ini := coalesce(p_inicio, date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date);
  v_fim := coalesce(p_fim, (now() at time zone 'America/Sao_Paulo')::date);

  -- Admin e produção veem a empresa toda; comercial, só as próprias vendas.
  v_todos := public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'producao');
  select a.vendedor_id into v_vendedor from public.admin_users a where a.id = auth.uid();
  if not v_todos and v_vendedor is null then
    v_vendedor := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  select coalesce(imposto_pct, 0), coalesce(taxa_cartao_pct, 0)
    into v_imposto, v_taxa_padrao
  from public.sistema_financeiro_config limit 1;
  v_imposto := coalesce(v_imposto, 0);
  v_taxa_padrao := coalesce(v_taxa_padrao, 0);

  with pedido as (
    select p.id, p.numero, p.created_at, p.total,
           c.nome as cliente_nome,
           (p.created_at at time zone 'America/Sao_Paulo')::date as dia,
           case
             when mp.nome is null then 0
             when mp.nome ilike '%cart%' then coalesce(mp.taxa_pct, v_taxa_padrao)
             else 0
           end as taxa_pct
    from public.sistema_pedidos p
    left join public.sistema_meios_pagamento mp on mp.id = p.pagamento_id
    left join public.sistema_clientes c on c.id = p.cliente_id
    where p.status <> 'cancelado'
      and (v_todos or p.vendedor_id = v_vendedor)
      and (p.created_at at time zone 'America/Sao_Paulo')::date between v_ini and v_fim
  ),
  liquido as (
    select pedido.*,
           round(total - total * v_imposto / 100 - total * taxa_pct / 100, 2) as valor_liquido
    from pedido
  ),
  orcamento as (
    select o.id, o.status, o.subtotal
    from public.sistema_orcamentos o
    where (v_todos or o.vendedor_id = v_vendedor)
      and (o.created_at at time zone 'America/Sao_Paulo')::date between v_ini and v_fim
  ),
  dias as (
    select generate_series(v_ini, v_fim, interval '1 day')::date as dia
  )
  select json_build_object(
    'inicio', v_ini,
    'fim', v_fim,
    'vendido_bruto', (select coalesce(sum(total), 0) from liquido),
    'vendido_liquido', (select coalesce(sum(valor_liquido), 0) from liquido),
    'pedidos', (select count(*) from liquido),
    'ticket', (select case when count(*) = 0 then 0
                          else round(sum(valor_liquido) / count(*), 2) end from liquido),
    'orcamentos', (select count(*) from orcamento),
    'orcamentos_aprovados', (select count(*) from orcamento where status = 'aprovado'),
    'orcamentos_valor', (select coalesce(sum(subtotal), 0) from orcamento),
    'serie', (
      select coalesce(json_agg(json_build_object(
        'dia', d.dia,
        'vendido', coalesce(s.valor, 0),
        'pedidos', coalesce(s.qtd, 0)
      ) order by d.dia), '[]'::json)
      from dias d
      left join (
        select dia, sum(valor_liquido) as valor, count(*) as qtd
        from liquido group by dia
      ) s on s.dia = d.dia
    ),
    'maiores', (
      select coalesce(json_agg(x), '[]'::json) from (
        select numero, cliente_nome, valor_liquido
        from liquido order by valor_liquido desc limit 8
      ) x
    )
  ) into v_json;

  return v_json;
end;
$$;

revoke all on function public.sistema_dashboard_comercial(date, date) from public, anon;
grant execute on function public.sistema_dashboard_comercial(date, date) to authenticated;
