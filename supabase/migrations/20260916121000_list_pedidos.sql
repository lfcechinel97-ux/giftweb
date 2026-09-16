-- =====================================================================
-- GIFT WEB - sistema_list_pedidos: uma consulta paginada por pagina da
-- tela, no lugar das tres consultas "puxa tudo" de hoje.
--
-- Substitui:
--   1. sistema_pedidos.select("*")            -> trazia o jsonb `itens`
--                                                inteiro de cada pedido
--   2. sistema_producao_itens.select(...)     -> tabela INTEIRA, sem
--                                                filtro nem limite, so
--                                                para o contador "x/y"
--   3. sistema_clientes.select("*")           -> todos os clientes so
--                                                para resolver 10 nomes
--
-- Segue a convencao de sistema_list_orcamentos: plpgsql, STABLE
-- SECURITY DEFINER com guarda explicita de is_admin_user(), data_fim
-- exclusiva (+1 dia), v_size limitado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Campos que o layout do Calcme exige e nao existiam
-- ---------------------------------------------------------------------

-- "Cliente (Razao Social)" no cabecalho do grupo
alter table public.sistema_clientes
  add column if not exists razao_social text;

-- "#12345 v1" — a versao ao lado do numero
alter table public.sistema_pedidos
  add column if not exists versao int not null default 1;

-- Busca por nome de produto dentro do jsonb (mesmo padrao que
-- sistema_list_orcamentos usa para orcamentos)
create index if not exists idx_pedidos_itens_trgm
  on public.sistema_pedidos using gin ((itens::text) gin_trgm_ops);

create index if not exists idx_clientes_nome_trgm
  on public.sistema_clientes using gin (nome gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 2) A funcao
-- ---------------------------------------------------------------------
drop function if exists public.sistema_list_pedidos(text, text, text, date, date, integer, integer);

create or replace function public.sistema_list_pedidos(
  p_status     text    default null,
  p_search     text    default null,
  p_cliente    text    default null,
  p_data_inicio date   default null,
  p_data_fim   date    default null,
  p_page       integer default 1,
  p_page_size  integer default 25
)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_rows json;
  v_total bigint;
  v_soma numeric;
  v_size integer;
  v_offset integer;
  v_search text;
  v_cliente text;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  v_size    := least(greatest(coalesce(p_page_size, 25), 1), 200);
  v_offset  := (greatest(coalesce(p_page, 1), 1) - 1) * v_size;
  v_search  := nullif(trim(coalesce(p_search, '')), '');
  v_cliente := nullif(trim(coalesce(p_cliente, '')), '');

  -- Filtro aplicado UMA vez; a CTE e referenciada duas vezes (contagem e
  -- pagina), entao o Postgres a materializa.
  with filtrados as (
    select p.id, p.created_at, p.total
    from public.sistema_pedidos p
    left join public.sistema_clientes c on c.id = p.cliente_id
    where (p_status is null or p_status = '' or p_status = 'todos' or p.status = p_status)
      and (p_data_inicio is null or p.created_at >= p_data_inicio::timestamptz)
      and (p_data_fim   is null or p.created_at <  (p_data_fim + 1)::timestamptz)
      and (
        v_cliente is null
        or c.nome ilike '%' || v_cliente || '%'
        or c.razao_social ilike '%' || v_cliente || '%'
        or p.contato_nome ilike '%' || v_cliente || '%'
        or coalesce(p.cliente_snapshot->>'nome', '') ilike '%' || v_cliente || '%'
      )
      and (
        v_search is null
        or p.numero ilike '%' || v_search || '%'
        or p.contato_nome ilike '%' || v_search || '%'
        or c.nome ilike '%' || v_search || '%'
        or coalesce(p.cliente_snapshot->>'nome', '') ilike '%' || v_search || '%'
        or p.itens::text ilike '%' || v_search || '%'
      )
  ),
  pagina as (
    select id from filtrados order by created_at desc limit v_size offset v_offset
  ),
  -- Itens SO dos pedidos desta pagina, ja com o status individual, o
  -- rotulo/cor do catalogo, a linha de personalizacao e a contagem de
  -- anexos (o icone de clipe do print).
  itens as (
    select
      pg.id as pedido_id,
      json_agg(
        json_build_object(
          'id',             e.value->>'id',
          'nome',           e.value->>'nome',
          'quantidade',     (e.value->>'quantidade')::numeric,
          'precoUnitario',  (e.value->>'precoUnitario')::numeric,
          'total',          coalesce(
                              (e.value->>'total')::numeric,
                              (e.value->>'quantidade')::numeric * (e.value->>'precoUnitario')::numeric),
          'imagem',         coalesce(e.value->>'mockupImagem', e.value->>'imagem'),
          'observacao',     e.value->>'observacao',
          'codigoComposto', e.value->>'codigoComposto',
          'personalizacao', coalesce(ci.descricao, pi.descricao_personalizacao),
          'tecnica',        tc.nome,
          'producaoId',     pi.id,
          'status',         pi.status,
          'statusNome',     s.nome,
          'statusCor',      s.cor,
          'colunaPcp',      s.coluna_pcp,
          'localProducao',  pi.local_producao,
          'anexos',         coalesce(ar.qtd, 0)
        ) order by e.ord
      ) as itens
    from pagina pg
    join public.sistema_pedidos p on p.id = pg.id
    cross join lateral jsonb_array_elements(p.itens) with ordinality as e(value, ord)
    left join public.sistema_producao_itens pi
           on pi.pedido_id = p.id and pi.item_id = (e.value->>'id')::uuid
    left join public.sistema_status s   on s.slug = pi.status
    left join public.sistema_tecnicas tc on tc.id = pi.tecnica_id
    left join public.sistema_calcme_itens ci
           on ci.pedido_id = p.id and ci.item_id = (e.value->>'id')::uuid
    left join lateral (
      select count(*) as qtd
      from public.sistema_calcme_item_arquivos a
      where a.item_id = ci.id
    ) ar on true
    group by pg.id
  )
  select
    (select count(*) from filtrados),
    (select coalesce(sum(f.total), 0) from filtrados f
      where f.id in (select id from pagina)),
    coalesce(json_agg(linha order by linha_created_at desc), '[]'::json)
  into v_total, v_soma, v_rows
  from (
    select
      p.created_at as linha_created_at,
      json_build_object(
        'id',            p.id,
        'numero',        p.numero,
        'versao',        p.versao,
        'status',        p.status,
        'statusNome',    s.nome,
        'statusCor',     s.cor,
        'createdAt',     p.created_at,
        'clienteId',     p.cliente_id,
        'clienteNome',   coalesce(c.nome, p.cliente_snapshot->>'nome', p.contato_nome),
        'razaoSocial',   c.razao_social,
        'entrega',       coalesce(p.data_despachar_ate::text, p.calcme_data_entrega::text),
        'contatoNome',   p.contato_nome,
        'contatoTelefone', p.contato_telefone,
        'vendedorId',    p.vendedor_id,
        'vendedorNome',  coalesce(v.nome, p.calcme_vendedor_nome),
        'subtotal',      p.subtotal,
        'freteValor',    p.frete_valor,
        'total',         p.total,
        'calcmeOrderId', p.calcme_order_id,
        'calcmeStatus',  p.calcme_status,
        'totalItens',    coalesce(json_array_length(i.itens), 0),
        'itens',         coalesce(i.itens, '[]'::json)
      ) as linha
    from pagina pg
    join public.sistema_pedidos p on p.id = pg.id
    left join public.sistema_status s     on s.slug = p.status
    left join public.sistema_clientes c   on c.id = p.cliente_id
    left join public.sistema_vendedores v on v.id = p.vendedor_id
    left join itens i on i.pedido_id = p.id
  ) linhas;

  return json_build_object(
    'total_count',  coalesce(v_total, 0),
    'total_pagina', coalesce(v_soma, 0),   -- "Valor Total" do rodape da tabela
    'rows',         coalesce(v_rows, '[]'::json)
  );
end;
$function$;

grant execute on function public.sistema_list_pedidos(text, text, text, date, date, integer, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) Troca de status de UM item — evita ler/gravar a linha inteira e
--    devolve so o que a UI precisa repintar (requisito de invalidacao
--    pontual por linha, sem recarregar a lista).
-- ---------------------------------------------------------------------
create or replace function public.sistema_set_status_item(
  p_producao_id uuid,
  p_status text
)
returns json
language plpgsql
volatile security definer
set search_path to 'public'
as $function$
declare v json;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  update public.sistema_producao_itens
     set status = p_status, updated_at = now()
   where id = p_producao_id;

  if not found then
    raise exception 'Item de producao % nao encontrado', p_producao_id;
  end if;

  select json_build_object(
    'producaoId', pi.id,
    'pedidoId',   pi.pedido_id,
    'status',     pi.status,
    'statusNome', s.nome,
    'statusCor',  s.cor,
    'colunaPcp',  s.coluna_pcp
  ) into v
  from public.sistema_producao_itens pi
  join public.sistema_status s on s.slug = pi.status
  where pi.id = p_producao_id;

  return v;
end;
$function$;

grant execute on function public.sistema_set_status_item(uuid, text)
  to authenticated, service_role;
