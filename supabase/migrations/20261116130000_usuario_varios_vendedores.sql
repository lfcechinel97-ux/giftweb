-- =====================================================================
-- Usuário vinculado a MAIS DE UM vendedor.
--   admin_users.vendedor_id        = vendedor principal (assina histórico
--                                    e nasce nos pedidos novos), como antes.
--   admin_users.vendedores_extras  = outros vendedores cujas vendas esse
--                                    usuário também vê (orçamentos, pedidos,
--                                    PCP, compras, painel comercial).
-- =====================================================================

alter table public.admin_users
  add column if not exists vendedores_extras uuid[] not null default '{}';

-- Vendedores que o usuário logado enxerga (principal + extras).
create or replace function public.sistema_meus_vendedores()
returns uuid[]
language sql stable security definer set search_path = public
as $$
  select coalesce(array(
    select distinct x
    from public.admin_users a,
         unnest(array[a.vendedor_id] || coalesce(a.vendedores_extras, '{}')) x
    where a.id = auth.uid() and x is not null
  ), '{}');
$$;
revoke all on function public.sistema_meus_vendedores() from public, anon;
grant execute on function public.sistema_meus_vendedores() to authenticated;

-- Lista de usuários passa a devolver os vendedores extras.
drop function if exists public.sistema_listar_usuarios();
create function public.sistema_listar_usuarios()
returns table (user_id uuid, email text, nome text, papel text, vendedor_id uuid, created_at timestamptz, vendedores_extras uuid[])
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
      a.vendedor_id, a.created_at, coalesce(a.vendedores_extras, '{}'::uuid[])
    from public.admin_users a
    order by a.nome nulls last, a.email;
end;
$$;
revoke all on function public.sistema_listar_usuarios() from public, anon;
grant execute on function public.sistema_listar_usuarios() to authenticated;

-- Salvar usuário com os vendedores extras (null = mantém os que já tem).
drop function if exists public.sistema_salvar_usuario(text, text, public.app_role, uuid);
create or replace function public.sistema_salvar_usuario(
  p_email text, p_nome text, p_papel public.app_role, p_vendedor_id uuid default null,
  p_vendedores_extras uuid[] default null
)
returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare v_id uuid; v_email text; v_extras uuid[];
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas administradores podem gerenciar usuários.';
  end if;

  select u.id, u.email into v_id, v_email
  from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Nenhuma conta de login com o e-mail %.', p_email;
  end if;

  if v_id = auth.uid() and p_papel <> 'admin' then
    raise exception 'Você não pode tirar seu próprio acesso de administrador.';
  end if;

  -- Extras sem repetir o principal nem nulos.
  if p_vendedores_extras is not null then
    v_extras := coalesce(array(
      select distinct x from unnest(p_vendedores_extras) x
      where x is not null and x is distinct from p_vendedor_id
    ), '{}');
  end if;

  insert into public.admin_users (id, email, nome, vendedor_id, vendedores_extras)
  values (v_id, v_email, nullif(trim(p_nome), ''), p_vendedor_id, coalesce(v_extras, '{}'))
  on conflict (id) do update
    set email = excluded.email, nome = excluded.nome, vendedor_id = excluded.vendedor_id,
        vendedores_extras = coalesce(v_extras, admin_users.vendedores_extras);

  delete from public.user_roles where user_id = v_id;
  insert into public.user_roles (user_id, role) values (v_id, p_papel);

  return v_id;
end;
$$;
revoke all on function public.sistema_salvar_usuario(text, text, public.app_role, uuid, uuid[]) from public, anon;
grant execute on function public.sistema_salvar_usuario(text, text, public.app_role, uuid, uuid[]) to authenticated;

-- Contagem das abas de /pedidos aceita uma lista de vendedores.
drop function if exists public.sistema_contar_pedidos_por_etapa(uuid);
create or replace function public.sistema_contar_pedidos_por_etapa(
  p_vendedor_id uuid default null,
  p_vendedor_ids uuid[] default null
)
returns table (coluna_pcp text, total bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with base as (
    select pi.pedido_id, s.coluna_pcp as coluna
    from public.sistema_producao_itens pi
    join public.sistema_pedidos p on p.id = pi.pedido_id
    join public.sistema_status s on s.slug = pi.status
    where (p_vendedor_id is null or p.vendedor_id = p_vendedor_id)
      and (p_vendedor_ids is null or p.vendedor_id = any(p_vendedor_ids))
    union
    select p.id, s2.coluna_pcp
    from public.sistema_pedidos p
    join public.sistema_status s2 on s2.slug = p.status
    where not exists (select 1 from public.sistema_producao_itens pi2 where pi2.pedido_id = p.id)
      and (p_vendedor_id is null or p.vendedor_id = p_vendedor_id)
      and (p_vendedor_ids is null or p.vendedor_id = any(p_vendedor_ids))
  )
  select coluna, count(distinct pedido_id) from base group by coluna;
$$;
grant execute on function public.sistema_contar_pedidos_por_etapa(uuid, uuid[]) to authenticated;

-- Lista de orçamentos aceita uma lista de vendedores.
DROP FUNCTION IF EXISTS public.sistema_list_orcamentos(uuid, text, text, text, integer, integer, integer, date, date);
CREATE OR REPLACE FUNCTION public.sistema_list_orcamentos(
  p_vendedor_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_cliente text DEFAULT NULL,
  p_limit integer DEFAULT 250,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL,
  p_vendedor_ids uuid[] DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rows json;
  v_total bigint;
  v_size integer;
  v_offset integer;
  v_search text;
  v_cliente text;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_size := LEAST(GREATEST(COALESCE(p_page_size, p_limit, 250), 1), 500);
  v_offset := GREATEST(COALESCE(p_page, 1), 1) - 1;
  v_offset := v_offset * v_size;
  v_search := NULLIF(trim(COALESCE(p_search, '')), '');
  v_cliente := NULLIF(trim(COALESCE(p_cliente, '')), '');

  WITH filtered AS (
    SELECT o.id
    FROM public.sistema_orcamentos o
    LEFT JOIN public.sistema_clientes c ON c.id = o.cliente_id
    WHERE (p_vendedor_id IS NULL OR o.vendedor_id = p_vendedor_id)
      AND (p_vendedor_ids IS NULL OR o.vendedor_id = ANY(p_vendedor_ids))
      AND (p_status IS NULL OR p_status = '' OR p_status = 'todos' OR o.status = p_status)
      AND (p_data_inicio IS NULL OR o.created_at >= p_data_inicio::timestamptz)
      AND (p_data_fim IS NULL OR o.created_at < (p_data_fim + 1)::timestamptz)
      AND (
        v_cliente IS NULL
        OR c.nome ILIKE '%' || v_cliente || '%'
        OR COALESCE(o.cliente_snapshot->>'nome', '') ILIKE '%' || v_cliente || '%'
      )
      AND (
        v_search IS NULL
        OR o.numero ILIKE '%' || v_search || '%'
        OR c.nome ILIKE '%' || v_search || '%'
        OR COALESCE(o.cliente_snapshot->>'nome', '') ILIKE '%' || v_search || '%'
        OR o.itens::text ILIKE '%' || v_search || '%'
      )
  )
  SELECT count(*) INTO v_total FROM filtered;

  WITH filtered AS (
    SELECT o.*
    FROM public.sistema_orcamentos o
    LEFT JOIN public.sistema_clientes c ON c.id = o.cliente_id
    WHERE (p_vendedor_id IS NULL OR o.vendedor_id = p_vendedor_id)
      AND (p_vendedor_ids IS NULL OR o.vendedor_id = ANY(p_vendedor_ids))
      AND (p_status IS NULL OR p_status = '' OR p_status = 'todos' OR o.status = p_status)
      AND (p_data_inicio IS NULL OR o.created_at >= p_data_inicio::timestamptz)
      AND (p_data_fim IS NULL OR o.created_at < (p_data_fim + 1)::timestamptz)
      AND (
        v_cliente IS NULL
        OR c.nome ILIKE '%' || v_cliente || '%'
        OR COALESCE(o.cliente_snapshot->>'nome', '') ILIKE '%' || v_cliente || '%'
      )
      AND (
        v_search IS NULL
        OR o.numero ILIKE '%' || v_search || '%'
        OR c.nome ILIKE '%' || v_search || '%'
        OR COALESCE(o.cliente_snapshot->>'nome', '') ILIKE '%' || v_search || '%'
        OR o.itens::text ILIKE '%' || v_search || '%'
      )
  )
  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      f.id, f.numero, f.cliente_id, f.cliente_snapshot,
      f.contato_nome, f.contato_telefone, f.contato_email,
      f.vendedor_id, f.origem_id,
      '[]'::jsonb AS itens,
      f.subtotal, f.frete_tipo, f.frete_valor, f.transportadora_id,
      f.prazo_entrega, f.pagamento_id, f.observacoes, f.status, f.aprovado_em,
      f.prazo_producao_dias, f.data_produzir_ate, f.data_despachar_ate,
      NULL::text AS anexo_url,
      f.created_at, f.updated_at
    FROM filtered f
    ORDER BY f.created_at DESC
    LIMIT v_size OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', COALESCE(v_total, 0));
END;
$function$;
REVOKE ALL ON FUNCTION public.sistema_list_orcamentos(uuid, text, text, text, integer, integer, integer, date, date, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sistema_list_orcamentos(uuid, text, text, text, integer, integer, integer, date, date, uuid[]) TO authenticated, service_role;

-- Painel comercial: soma as vendas de todos os vendedores vinculados.
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
  v_vendedores uuid[];
  v_todos boolean;
  v_imposto numeric;
  v_taxa_padrao numeric;
  v_json json;
begin
  v_ini := coalesce(p_inicio, date_trunc('month', (now() at time zone 'America/Sao_Paulo'))::date);
  v_fim := coalesce(p_fim, (now() at time zone 'America/Sao_Paulo')::date);

  -- Admin, gerente e produção veem a empresa toda; comercial, só as próprias vendas.
  v_todos := public.is_gestor(auth.uid()) or public.has_role(auth.uid(), 'producao');
  v_vendedores := public.sistema_meus_vendedores();
  if not v_todos and coalesce(array_length(v_vendedores, 1), 0) = 0 then
    v_vendedores := array['00000000-0000-0000-0000-000000000000'::uuid];
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
      and (v_todos or p.vendedor_id = any(v_vendedores))
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
    where (v_todos or o.vendedor_id = any(v_vendedores))
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
