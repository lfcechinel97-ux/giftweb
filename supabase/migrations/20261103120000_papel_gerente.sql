-- =====================================================================
-- GIFT WEB - Papel GERENTE: tudo que o admin faz (PCP de todos os
-- vendedores, pedidos, compras com custo, estoque, produtos, clientes,
-- mockups, WhatsApp...) MENOS:
--   * financeiro (dashboard de lucro/despesas, fluxo de vendas e as
--     tabelas que o alimentam);
--   * cadastro de usuários e papéis (senão poderia se promover a admin).
--
-- Como: is_gestor(uid) = admin OU gerente. Toda policy que hoje exige
-- has_role(..., 'admin') passa a usar is_gestor(...), exceto nas tabelas
-- da lista "so_admin" abaixo, que continuam só admin.
-- has_role() NÃO muda — as funções de usuários e a edge function
-- sistema-criar-usuario seguem exigindo admin de verdade.
--
-- Pode rodar no SQL Editor de uma vez: o valor novo do enum só é usado
-- como texto (role::text), então não esbarra em "unsafe use of new value".
-- Para policies NOVAS: use public.is_gestor(auth.uid()) para "admin ou
-- gerente" e has_role(auth.uid(), 'admin') só para financeiro/usuários.
-- =====================================================================

alter type public.app_role add value if not exists 'gerente';

create or replace function public.is_gestor(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role::text in ('admin', 'gerente')
  );
$$;
revoke all on function public.is_gestor(uuid) from public, anon;
grant execute on function public.is_gestor(uuid) to authenticated;

-- Reescreve as policies "só admin" (public e storage) para admin ou gerente.
do $$
declare
  p record;
  so_admin text[] := array[
    'user_roles', 'admin_users',
    'sistema_financeiro_config', 'sistema_calcme_vendas', 'sistema_calcme_venda_itens',
    'sistema_custo_produto', 'sistema_despesa_categorias', 'sistema_orcamento',
    'sistema_despesas', 'sistema_recebimentos', 'sistema_financeiro_sync_log',
    'sistema_pedido_financeiro', 'sistema_item_financeiro'
  ];
  padrao text := '(public\.)?has_role\(([^,'']+), ''admin''::(public\.)?app_role\)';
  troca text := 'public.is_gestor(\2)';
  v_qual text;
  v_check text;
  v_sql text;
begin
  for p in
    select schemaname, tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (coalesce(qual, '') ~ padrao or coalesce(with_check, '') ~ padrao)
  loop
    if p.schemaname = 'public' and p.tablename = any(so_admin) then
      continue;
    end if;
    v_qual := case when p.qual is null then null else regexp_replace(p.qual, padrao, troca, 'g') end;
    v_check := case when p.with_check is null then null else regexp_replace(p.with_check, padrao, troca, 'g') end;
    v_sql := format('alter policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
    if v_qual is not null then v_sql := v_sql || format(' using (%s)', v_qual); end if;
    if v_check is not null then v_sql := v_sql || format(' with check (%s)', v_check); end if;
    begin
      execute v_sql;
      raise notice 'gerente liberado: %.% (%)', p.schemaname, p.tablename, p.policyname;
    exception when others then
      -- ex.: storage.objects pertence a outro papel no Supabase.
      raise warning 'não foi possível ajustar %.% (%): %', p.schemaname, p.tablename, p.policyname, sqlerrm;
    end;
  end loop;
end $$;

-- Perfil e lista de usuários passam a reconhecer o gerente (o acesso à
-- lista continua só admin).
create or replace function public.sistema_meu_perfil()
returns table (user_id uuid, email text, nome text, papel text, vendedor_id uuid)
language sql stable security definer set search_path = public
as $$
  select a.id, a.email, a.nome,
    case when public.has_role(a.id, 'admin') then 'admin'
         when exists (select 1 from public.user_roles r where r.user_id = a.id and r.role::text = 'gerente') then 'gerente'
         when public.has_role(a.id, 'producao') then 'producao'
         else 'vendedor' end,
    a.vendedor_id
  from public.admin_users a
  where a.id = auth.uid();
$$;

create or replace function public.sistema_listar_usuarios()
returns table (user_id uuid, email text, nome text, papel text, vendedor_id uuid, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas administradores podem ver os usuários.';
  end if;
  return query
    select a.id, a.email, a.nome,
      case when public.has_role(a.id, 'admin') then 'admin'
           when exists (select 1 from public.user_roles r where r.user_id = a.id and r.role::text = 'gerente') then 'gerente'
           when public.has_role(a.id, 'producao') then 'producao'
           else 'vendedor' end,
      a.vendedor_id, a.created_at
    from public.admin_users a
    order by a.nome nulls last, a.email;
end;
$$;

-- Painel do comercial: gerente vê a equipe toda (como admin e produção).
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

  -- Admin, gerente e produção veem a empresa toda; comercial, só as próprias vendas.
  v_todos := public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'producao');
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
