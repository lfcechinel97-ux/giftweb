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
    SELECT COALESCE(array_agg(t), ARRAY[]::text[]) INTO v_tokens
    FROM (
      SELECT lower(tok) AS t
      FROM unnest(regexp_split_to_array(v_term, '\s+')) AS tok
      WHERE length(tok) >= 2
    ) s;
  END IF;

  WITH xbz AS (
    SELECT
      pc.id,
      pc.nome,
      pc.slug,
      pc.codigo_amigavel,
      pc.codigo_prefixo,
      pc.image_url,
      pc.image_urls,
      pc.preco_custo,
      pc.estoque,
      pc.estoque_total,
      pc.categoria,
      pc.tabela_precos,
      pc.variantes,
      pc.variantes_count,
      pc.is_variante,
      pc.is_hidden,
      pc.produto_pai,
      pc.ativo,
      pc.has_image,
      pc.cor,
      pc.altura,
      pc.largura,
      false AS is_custom,
      COALESCE(NULLIF(pc.codigo_prefixo, ''), split_part(pc.codigo_amigavel, '-', 1), pc.codigo_amigavel) AS group_key,
      CASE
        WHEN v_term IS NOT NULL AND pc.codigo_amigavel ILIKE v_term || '%' THEN 0
        WHEN v_term IS NOT NULL AND pc.nome ILIKE v_term || '%' THEN 1
        WHEN v_term IS NOT NULL AND pc.nome ILIKE '%' || v_term || '%' THEN 2
        ELSE 3
      END AS rank_score
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND (
        v_term IS NULL
        OR pc.codigo_amigavel ILIKE '%' || v_term || '%'
        OR COALESCE(pc.codigo_prefixo, '') ILIKE '%' || v_term || '%'
        OR (
          v_tokens IS NOT NULL AND array_length(v_tokens, 1) > 0
          AND NOT EXISTS (SELECT 1 FROM unnest(v_tokens) tk WHERE pc.busca NOT ILIKE '%' || tk || '%')
        )
      )
  ), custom AS (
    SELECT
      cp.id,
      cp.nome,
      NULL::text AS slug,
      cp.codigo AS codigo_amigavel,
      NULL::text AS codigo_prefixo,
      cp.image_url,
      NULL::text[] AS image_urls,
      cp.preco_custo,
      cp.estoque,
      cp.estoque AS estoque_total,
      cp.categoria,
      NULL::jsonb AS tabela_precos,
      NULL::jsonb AS variantes,
      (1 + (SELECT count(*) FROM public.sistema_produtos_custom v WHERE v.parent_id = cp.id))::int AS variantes_count,
      (cp.parent_id IS NOT NULL) AS is_variante,
      false AS is_hidden,
      cp.parent_id AS produto_pai,
      true AS ativo,
      (cp.image_url IS NOT NULL AND cp.image_url <> '') AS has_image,
      cp.cor,
      NULL::numeric AS altura,
      NULL::numeric AS largura,
      true AS is_custom,
      COALESCE(cp.parent_id::text, cp.id::text) AS group_key,
      CASE
        WHEN v_term IS NOT NULL AND cp.codigo ILIKE v_term || '%' THEN 0
        WHEN v_term IS NOT NULL AND cp.nome ILIKE v_term || '%' THEN 1
        WHEN v_term IS NOT NULL AND cp.nome ILIKE '%' || v_term || '%' THEN 2
        ELSE 3
      END AS rank_score
    FROM public.sistema_produtos_custom cp
    WHERE (
      v_term IS NULL
      OR cp.codigo ILIKE '%' || v_term || '%'
      OR (
        v_tokens IS NOT NULL AND array_length(v_tokens, 1) > 0
        AND NOT EXISTS (
          SELECT 1 FROM unnest(v_tokens) tk
          WHERE lower(cp.nome || ' ' || cp.codigo || ' ' || COALESCE(cp.cor,'') || ' ' || COALESCE(cp.categoria,'')) NOT LIKE '%' || tk || '%'
        )
      )
    )
  ), unioned AS (
    SELECT * FROM xbz
    UNION ALL
    SELECT * FROM custom
  ), ranked AS (
    SELECT u.*,
      row_number() OVER (
        PARTITION BY group_key, is_custom
        ORDER BY rank_score ASC, COALESCE(is_variante, false) ASC, length(codigo_amigavel), codigo_amigavel ASC
      ) AS rn
    FROM unioned u
  )
  SELECT count(*) INTO v_total FROM ranked WHERE rn = 1;

  WITH xbz AS (
    SELECT
      pc.id,
      pc.nome,
      pc.slug,
      pc.codigo_amigavel,
      pc.codigo_prefixo,
      pc.image_url,
      pc.image_urls,
      pc.preco_custo,
      pc.estoque,
      pc.estoque_total,
      pc.categoria,
      pc.tabela_precos,
      pc.variantes,
      pc.variantes_count,
      pc.is_variante,
      pc.is_hidden,
      pc.produto_pai,
      pc.ativo,
      pc.has_image,
      pc.cor,
      pc.altura,
      pc.largura,
      false AS is_custom,
      COALESCE(NULLIF(pc.codigo_prefixo, ''), split_part(pc.codigo_amigavel, '-', 1), pc.codigo_amigavel) AS group_key,
      CASE
        WHEN v_term IS NOT NULL AND pc.codigo_amigavel ILIKE v_term || '%' THEN 0
        WHEN v_term IS NOT NULL AND pc.nome ILIKE v_term || '%' THEN 1
        WHEN v_term IS NOT NULL AND pc.nome ILIKE '%' || v_term || '%' THEN 2
        ELSE 3
      END AS rank_score
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND (
        v_term IS NULL
        OR pc.codigo_amigavel ILIKE '%' || v_term || '%'
        OR COALESCE(pc.codigo_prefixo, '') ILIKE '%' || v_term || '%'
        OR (
          v_tokens IS NOT NULL AND array_length(v_tokens, 1) > 0
          AND NOT EXISTS (SELECT 1 FROM unnest(v_tokens) tk WHERE pc.busca NOT ILIKE '%' || tk || '%')
        )
      )
  ), custom AS (
    SELECT
      cp.id,
      cp.nome,
      NULL::text AS slug,
      cp.codigo AS codigo_amigavel,
      NULL::text AS codigo_prefixo,
      cp.image_url,
      NULL::text[] AS image_urls,
      cp.preco_custo,
      cp.estoque,
      cp.estoque AS estoque_total,
      cp.categoria,
      NULL::jsonb AS tabela_precos,
      NULL::jsonb AS variantes,
      (1 + (SELECT count(*) FROM public.sistema_produtos_custom v WHERE v.parent_id = cp.id))::int AS variantes_count,
      (cp.parent_id IS NOT NULL) AS is_variante,
      false AS is_hidden,
      cp.parent_id AS produto_pai,
      true AS ativo,
      (cp.image_url IS NOT NULL AND cp.image_url <> '') AS has_image,
      cp.cor,
      NULL::numeric AS altura,
      NULL::numeric AS largura,
      true AS is_custom,
      COALESCE(cp.parent_id::text, cp.id::text) AS group_key,
      CASE
        WHEN v_term IS NOT NULL AND cp.codigo ILIKE v_term || '%' THEN 0
        WHEN v_term IS NOT NULL AND cp.nome ILIKE v_term || '%' THEN 1
        WHEN v_term IS NOT NULL AND cp.nome ILIKE '%' || v_term || '%' THEN 2
        ELSE 3
      END AS rank_score
    FROM public.sistema_produtos_custom cp
    WHERE (
      v_term IS NULL
      OR cp.codigo ILIKE '%' || v_term || '%'
      OR (
        v_tokens IS NOT NULL AND array_length(v_tokens, 1) > 0
        AND NOT EXISTS (
          SELECT 1 FROM unnest(v_tokens) tk
          WHERE lower(cp.nome || ' ' || cp.codigo || ' ' || COALESCE(cp.cor,'') || ' ' || COALESCE(cp.categoria,'')) NOT LIKE '%' || tk || '%'
        )
      )
    )
  ), unioned AS (
    SELECT * FROM xbz
    UNION ALL
    SELECT * FROM custom
  ), ranked AS (
    SELECT u.*,
      row_number() OVER (
        PARTITION BY group_key, is_custom
        ORDER BY rank_score ASC, COALESCE(is_variante, false) ASC, length(codigo_amigavel), codigo_amigavel ASC
      ) AS rn
    FROM unioned u
  )
  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      id, nome, slug, codigo_amigavel, codigo_prefixo, image_url, image_urls,
      preco_custo, estoque, estoque_total, categoria, tabela_precos, variantes,
      variantes_count, is_variante, is_hidden, produto_pai, ativo, has_image, cor,
      altura, largura, is_custom
    FROM ranked
    WHERE rn = 1
    ORDER BY rank_score ASC, codigo_amigavel ASC
    LIMIT v_limit OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', COALESCE(v_total, 0));
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sistema_search_products(text, integer, integer) TO authenticated, service_role;