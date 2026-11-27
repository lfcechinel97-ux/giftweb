-- =====================================================================
-- GIFT WEB - Orçamentos: filtro que não quebra + busca única.
--
-- Problema: a busca fazia `o.itens::text ILIKE '%termo%'` em TODOS os
-- orçamentos, duas vezes (contagem e página). O jsonb de itens carrega
-- mockups/imagens e fica enorme: a consulta estourava o tempo limite e a
-- tela mostrava "Não foi possível carregar os orçamentos".
--
-- Agora (mesma regra da busca de Pedidos, sistema_buscar_pedidos):
--  - uma passada só (total via count(*) over ());
--  - produto: só nome e código de cada item, não o jsonb inteiro;
--  - busca única: nº do orçamento, cliente (nome, razão social, documento),
--    contato (nome, e-mail, WhatsApp) e produto, sem diferenciar acento.
-- A assinatura não muda (o front continua chamando igual).
-- =====================================================================

create or replace function public.sistema_list_orcamentos(
  p_vendedor_id uuid default null,
  p_status text default null,
  p_search text default null,
  p_cliente text default null,
  p_limit integer default 250,
  p_page integer default 1,
  p_page_size integer default null,
  p_data_inicio date default null,
  p_data_fim date default null,
  p_vendedor_ids uuid[] default null
)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_rows json;
  v_total bigint;
  v_size integer;
  v_offset integer;
  v_search text;
  v_cliente text;
  v_digitos text;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  v_size := least(greatest(coalesce(p_page_size, p_limit, 250), 1), 500);
  v_offset := (greatest(coalesce(p_page, 1), 1) - 1) * v_size;
  v_search := nullif(public.sistema_sem_acento(trim(coalesce(p_search, ''))), '');
  v_cliente := nullif(public.sistema_sem_acento(trim(coalesce(p_cliente, ''))), '');
  v_digitos := regexp_replace(coalesce(p_search, ''), '\D', '', 'g');

  with filtrado as (
    select o.id, o.numero, o.cliente_id, o.cliente_snapshot,
           o.contato_nome, o.contato_telefone, o.contato_email,
           o.vendedor_id, o.origem_id,
           o.subtotal, o.frete_tipo, o.frete_valor, o.transportadora_id,
           o.prazo_entrega, o.pagamento_id, o.observacoes, o.status, o.aprovado_em,
           o.prazo_producao_dias, o.data_produzir_ate, o.data_despachar_ate,
           o.created_at, o.updated_at,
           count(*) over () as total
      from public.sistema_orcamentos o
      left join public.sistema_clientes c on c.id = o.cliente_id
     where (p_vendedor_id is null or o.vendedor_id = p_vendedor_id)
       and (p_vendedor_ids is null or o.vendedor_id = any(p_vendedor_ids))
       and (p_status is null or p_status = '' or p_status = 'todos' or o.status = p_status)
       and (p_data_inicio is null or o.created_at >= p_data_inicio::timestamptz)
       and (p_data_fim is null or o.created_at < (p_data_fim + 1)::timestamptz)
       and (
         v_cliente is null
         or public.sistema_sem_acento(c.nome) like '%' || v_cliente || '%'
         or public.sistema_sem_acento(o.cliente_snapshot->>'nome') like '%' || v_cliente || '%'
       )
       and (
         v_search is null
         or public.sistema_sem_acento(o.numero) like '%' || v_search || '%'
         or public.sistema_sem_acento(c.nome) like '%' || v_search || '%'
         or public.sistema_sem_acento(c.razao_social) like '%' || v_search || '%'
         or public.sistema_sem_acento(o.cliente_snapshot->>'nome') like '%' || v_search || '%'
         or public.sistema_sem_acento(o.contato_nome) like '%' || v_search || '%'
         or public.sistema_sem_acento(o.contato_email) like '%' || v_search || '%'
         or (length(v_digitos) >= 4 and (
               regexp_replace(coalesce(c.documento, ''), '\D', '', 'g') like '%' || v_digitos || '%'
            or regexp_replace(coalesce(o.contato_telefone, ''), '\D', '', 'g') like '%' || v_digitos || '%'))
         or exists (
           select 1
             from jsonb_array_elements(case when jsonb_typeof(o.itens) = 'array' then o.itens else '[]'::jsonb end) i
            where public.sistema_sem_acento(i->>'nome') like '%' || v_search || '%'
               or public.sistema_sem_acento(i->>'codigoComposto') like '%' || v_search || '%'
         )
       )
     order by o.created_at desc, o.id desc
  ),
  pagina as (
    select * from filtrado limit v_size offset v_offset
  )
  select
    (select coalesce(max(total), 0) from filtrado),
    (select json_agg(row_to_json(t)) from (
       select p.id, p.numero, p.cliente_id, p.cliente_snapshot,
              p.contato_nome, p.contato_telefone, p.contato_email,
              p.vendedor_id, p.origem_id,
              '[]'::jsonb as itens,
              p.subtotal, p.frete_tipo, p.frete_valor, p.transportadora_id,
              p.prazo_entrega, p.pagamento_id, p.observacoes, p.status, p.aprovado_em,
              p.prazo_producao_dias, p.data_produzir_ate, p.data_despachar_ate,
              null::text as anexo_url,
              p.created_at, p.updated_at
         from pagina p
        order by p.created_at desc, p.id desc
     ) t)
  into v_total, v_rows;

  return json_build_object('rows', coalesce(v_rows, '[]'::json), 'total_count', coalesce(v_total, 0));
end;
$function$;

revoke all on function public.sistema_list_orcamentos(uuid, text, text, text, integer, integer, integer, date, date, uuid[]) from public, anon;
grant execute on function public.sistema_list_orcamentos(uuid, text, text, text, integer, integer, integer, date, date, uuid[]) to authenticated, service_role;

notify pgrst, 'reload schema';
