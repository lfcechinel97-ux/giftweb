CREATE OR REPLACE FUNCTION public.sistema_search_products(p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 60)
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
  v_limit integer;
  v_total bigint;
  v_rows json;
  v_term text;
  v_tokens text[];
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_page_size, 60), 1), 200);
  v_offset := (GREATEST(COALESCE(p_page, 1), 1) - 1) * v_limit;
  v_term := NULLIF(trim(COALESCE(p_search, '')), '');

  IF v_term IS NOT NULL THEN
    SELECT COALESCE(array_agg(t), ARRAY[]::text[])
      INTO v_tokens
    FROM (
      SELECT lower(tok) AS t
      FROM unnest(regexp_split_to_array(v_term, '\s+')) AS tok
      WHERE length(tok) >= 2
    ) s;
  END IF;

  WITH filtered AS (
    SELECT
      pc.*,
      COALESCE(NULLIF(pc.codigo_prefixo, ''), split_part(pc.codigo_amigavel, '-', 1), pc.codigo_amigavel) AS group_key
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND (
        v_term IS NULL
        OR pc.codigo_amigavel ILIKE '%' || v_term || '%'
        OR (
          v_tokens IS NOT NULL
          AND array_length(v_tokens, 1) > 0
          AND NOT EXISTS (
            SELECT 1 FROM unnest(v_tokens) tk
            WHERE pc.busca NOT ILIKE '%' || tk || '%'
          )
        )
      )
  ), grouped AS (
    SELECT DISTINCT group_key FROM filtered
  )
  SELECT count(*) INTO v_total FROM grouped;

  WITH filtered AS (
    SELECT
      pc.*,
      COALESCE(NULLIF(pc.codigo_prefixo, ''), split_part(pc.codigo_amigavel, '-', 1), pc.codigo_amigavel) AS group_key
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND (
        v_term IS NULL
        OR pc.codigo_amigavel ILIKE '%' || v_term || '%'
        OR (
          v_tokens IS NOT NULL
          AND array_length(v_tokens, 1) > 0
          AND NOT EXISTS (
            SELECT 1 FROM unnest(v_tokens) tk
            WHERE pc.busca NOT ILIKE '%' || tk || '%'
          )
        )
      )
  ), ranked AS (
    SELECT
      f.*,
      row_number() OVER (
        PARTITION BY f.group_key
        ORDER BY COALESCE(f.is_variante, false) ASC, length(f.codigo_amigavel), f.codigo_amigavel ASC
      ) AS rn
    FROM filtered f
  )
  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      id, nome, slug, codigo_amigavel, codigo_prefixo, image_url, image_urls,
      preco_custo, estoque, estoque_total, categoria, tabela_precos, variantes,
      variantes_count, is_variante, is_hidden, produto_pai, ativo, has_image, cor,
      altura, largura,
      CASE
        WHEN v_term IS NOT NULL AND nome ILIKE v_term || '%' THEN 0
        WHEN v_term IS NOT NULL AND nome ILIKE '%' || v_term || '%' THEN 1
        ELSE 2
      END AS _rank
    FROM ranked
    WHERE rn = 1
    ORDER BY _rank ASC, codigo_amigavel ASC
    LIMIT v_limit
    OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', COALESCE(v_total, 0));
END;
$function$;