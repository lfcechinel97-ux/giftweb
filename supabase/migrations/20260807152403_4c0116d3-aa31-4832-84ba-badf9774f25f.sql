DROP FUNCTION IF EXISTS public.sistema_list_orcamentos(text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.sistema_list_orcamentos(uuid, text, text, text, integer);

CREATE OR REPLACE FUNCTION public.sistema_list_orcamentos(
  p_vendedor_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_cliente text DEFAULT NULL,
  p_limit integer DEFAULT 250,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT NULL,
  p_data_inicio date DEFAULT NULL,
  p_data_fim date DEFAULT NULL
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