CREATE OR REPLACE FUNCTION public.sistema_get_bootstrap()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result json;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT json_build_object(
    'vendedores', COALESCE((
      SELECT json_agg(row_to_json(v) ORDER BY v.nome)
      FROM (
        SELECT id, nome, ativo, meta, created_at, updated_at
        FROM public.sistema_vendedores
        ORDER BY nome ASC
      ) v
    ), '[]'::json),
    'meios_pagamento', COALESCE((
      SELECT json_agg(row_to_json(m) ORDER BY m.nome)
      FROM (
        SELECT id, nome, ativo, meta, created_at, updated_at
        FROM public.sistema_meios_pagamento
        ORDER BY nome ASC
      ) m
    ), '[]'::json),
    'transportadoras', COALESCE((
      SELECT json_agg(row_to_json(t) ORDER BY t.nome)
      FROM (
        SELECT id, nome, ativo, tipo_frete, prazo_entrega, created_at, updated_at
        FROM public.sistema_transportadoras
        ORDER BY nome ASC
      ) t
    ), '[]'::json),
    'origens', COALESCE((
      SELECT json_agg(row_to_json(o) ORDER BY o.nome)
      FROM (
        SELECT id, nome, ativo, meta, created_at, updated_at
        FROM public.sistema_origens
        ORDER BY nome ASC
      ) o
    ), '[]'::json)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sistema_get_bootstrap() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sistema_list_orcamentos(
  p_vendedor_id uuid DEFAULT NULL::uuid,
  p_status text DEFAULT NULL::text,
  p_search text DEFAULT NULL::text,
  p_cliente text DEFAULT NULL::text,
  p_limit integer DEFAULT 250
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_rows json;
  v_total bigint;
  v_limit integer;
  v_search text;
  v_cliente text;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 250), 1), 500);
  v_search := NULLIF(trim(COALESCE(p_search, '')), '');
  v_cliente := NULLIF(trim(COALESCE(p_cliente, '')), '');

  WITH filtered AS (
    SELECT o.*
    FROM public.sistema_orcamentos o
    LEFT JOIN public.sistema_clientes c ON c.id = o.cliente_id
    WHERE (p_vendedor_id IS NULL OR o.vendedor_id = p_vendedor_id)
      AND (p_status IS NULL OR p_status = '' OR p_status = 'todos' OR o.status = p_status)
      AND (
        v_cliente IS NULL
        OR c.nome ILIKE '%' || v_cliente || '%'
        OR COALESCE(o.cliente_snapshot->>'nome', '') ILIKE '%' || v_cliente || '%'
      )
      AND (
        v_search IS NULL
        OR o.numero ILIKE '%' || v_search || '%'
        OR COALESCE(o.itens::text, '') ILIKE '%' || v_search || '%'
      )
  )
  SELECT count(*) INTO v_total FROM filtered;

  WITH filtered AS (
    SELECT o.*
    FROM public.sistema_orcamentos o
    LEFT JOIN public.sistema_clientes c ON c.id = o.cliente_id
    WHERE (p_vendedor_id IS NULL OR o.vendedor_id = p_vendedor_id)
      AND (p_status IS NULL OR p_status = '' OR p_status = 'todos' OR o.status = p_status)
      AND (
        v_cliente IS NULL
        OR c.nome ILIKE '%' || v_cliente || '%'
        OR COALESCE(o.cliente_snapshot->>'nome', '') ILIKE '%' || v_cliente || '%'
      )
      AND (
        v_search IS NULL
        OR o.numero ILIKE '%' || v_search || '%'
        OR COALESCE(o.itens::text, '') ILIKE '%' || v_search || '%'
      )
  )
  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT *
    FROM filtered
    ORDER BY created_at DESC
    LIMIT v_limit
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', COALESCE(v_total, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.sistema_list_orcamentos(uuid, text, text, text, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sistema_get_orcamento(p_id uuid)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row json;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT row_to_json(o) INTO v_row
  FROM public.sistema_orcamentos o
  WHERE o.id = p_id
  LIMIT 1;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sistema_get_orcamento(uuid) TO authenticated, service_role;