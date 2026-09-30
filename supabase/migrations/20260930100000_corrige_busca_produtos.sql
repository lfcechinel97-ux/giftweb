-- =====================================================================
-- GIFT WEB - Hotfix: a migration 20260929110000 (busca mais rápida)
-- tinha um bug -- a função devolvia 400 (column t.total_count does not
-- exist) para QUALQUER busca, inclusive a lista inicial "sem termo".
-- Achado testando de verdade: a coluna total_count era usada fora do
-- SELECT que a trazia.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.sistema_search_products(p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 60)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_offset integer;
  v_limit integer;
  v_term text;
  v_tokens text[];
  v_xbz_or text[] := ARRAY[]::text[];
  v_custom_or text[] := ARRAY[]::text[];
  v_token_xbz text[];
  v_token_custom text[];
  tok text;
  v_xbz_where text;
  v_custom_where text;
  v_sql text;
  v_rows json;
  v_total bigint;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_page_size, 60), 1), 200);
  v_offset := (GREATEST(COALESCE(p_page, 1), 1) - 1) * v_limit;
  v_term := NULLIF(trim(COALESCE(p_search, '')), '');

  IF v_term IS NULL THEN
    v_xbz_where := 'pc.ativo = true';
    v_custom_where := 'true';
  ELSE
    SELECT COALESCE(array_agg(DISTINCT lower(t)), ARRAY[]::text[]) INTO v_tokens
    FROM unnest(regexp_split_to_array(v_term, '\s+')) AS t
    WHERE length(t) >= 2;

    -- Sempre aceita bater pelo código (mesmo com 1 caractere, ou "01320-VM" inteiro).
    v_xbz_or := array_append(v_xbz_or, format('pc.codigo_amigavel ILIKE %L', '%' || v_term || '%'));
    v_xbz_or := array_append(v_xbz_or, format('COALESCE(pc.codigo_prefixo, %L) ILIKE %L', '', '%' || v_term || '%'));
    v_custom_or := array_append(v_custom_or, format('cp.codigo ILIKE %L', '%' || v_term || '%'));

    IF v_tokens IS NOT NULL AND array_length(v_tokens, 1) > 0 THEN
      v_token_xbz := ARRAY[]::text[];
      v_token_custom := ARRAY[]::text[];
      FOREACH tok IN ARRAY v_tokens LOOP
        v_token_xbz := array_append(v_token_xbz, format('pc.busca ILIKE %L', '%' || tok || '%'));
        v_token_custom := array_append(v_token_custom, format(
          'lower(cp.nome || %L || cp.codigo || %L || COALESCE(cp.cor, %L) || %L || COALESCE(cp.categoria, %L)) ILIKE %L',
          ' ', ' ', '', ' ', '', '%' || tok || '%'));
      END LOOP;
      -- "copo termico" = todas as palavras têm que bater (AND), como antes.
      v_xbz_or := array_append(v_xbz_or, '(' || array_to_string(v_token_xbz, ' AND ') || ')');
      v_custom_or := array_append(v_custom_or, '(' || array_to_string(v_token_custom, ' AND ') || ')');
    END IF;

    v_xbz_where := 'pc.ativo = true AND (' || array_to_string(v_xbz_or, ' OR ') || ')';
    v_custom_where := '(' || array_to_string(v_custom_or, ' OR ') || ')';
  END IF;

  v_sql := format($q$
    WITH xbz AS (
      SELECT
        pc.id, pc.nome, pc.slug, pc.codigo_amigavel, pc.codigo_prefixo, pc.image_url, pc.image_urls,
        pc.preco_custo, pc.estoque, pc.estoque_total, pc.categoria, pc.tabela_precos, pc.variantes,
        pc.variantes_count, pc.is_variante, pc.is_hidden, pc.produto_pai, pc.ativo, pc.has_image, pc.cor,
        pc.altura, pc.largura, false AS is_custom,
        COALESCE(NULLIF(pc.codigo_prefixo, ''), split_part(pc.codigo_amigavel, '-', 1), pc.codigo_amigavel) AS group_key
      FROM public.products_cache pc
      WHERE %s
    ), custom AS (
      SELECT
        cp.id, cp.nome, NULL::text AS slug, cp.codigo AS codigo_amigavel, NULL::text AS codigo_prefixo,
        cp.image_url, NULL::text[] AS image_urls, cp.preco_custo, cp.estoque, cp.estoque AS estoque_total,
        cp.categoria, NULL::jsonb AS tabela_precos, NULL::jsonb AS variantes,
        (1 + (SELECT count(*) FROM public.sistema_produtos_custom v WHERE v.parent_id = cp.id))::int AS variantes_count,
        (cp.parent_id IS NOT NULL) AS is_variante, false AS is_hidden, cp.parent_id AS produto_pai,
        true AS ativo, (cp.image_url IS NOT NULL AND cp.image_url <> '') AS has_image, cp.cor,
        NULL::numeric AS altura, NULL::numeric AS largura, true AS is_custom,
        COALESCE(cp.parent_id::text, cp.id::text) AS group_key
      FROM public.sistema_produtos_custom cp
      WHERE %s
    ), unioned AS (
      SELECT * FROM xbz
      UNION ALL
      SELECT * FROM custom
    ), ranked AS (
      SELECT u.*,
        row_number() OVER (
          PARTITION BY group_key, is_custom
          ORDER BY COALESCE(is_variante, false) ASC, length(codigo_amigavel), codigo_amigavel ASC
        ) AS rn,
        CASE
          WHEN $1 IS NOT NULL AND (codigo_amigavel ILIKE $1 || %L OR nome ILIKE $1 || %L) THEN 0
          WHEN $1 IS NOT NULL AND nome ILIKE %L || $1 || %L THEN 1
          ELSE 2
        END AS rank_score
      FROM unioned u
    ), final AS (
      SELECT *, count(*) OVER () AS total_count
      FROM ranked
      WHERE rn = 1
      ORDER BY rank_score ASC, codigo_amigavel ASC
      LIMIT $2 OFFSET $3
    )
    SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json), COALESCE(max(t.total_count), 0)
    FROM (
      -- total_count vai junto em cada linha (o front-end só usa as colunas que
      -- conhece e ignora o resto) -- mais simples e seguro que tentar tirar
      -- a coluna de dentro do json linha a linha.
      SELECT
        id, nome, slug, codigo_amigavel, codigo_prefixo, image_url, image_urls,
        preco_custo, estoque, estoque_total, categoria, tabela_precos, variantes,
        variantes_count, is_variante, is_hidden, produto_pai, ativo, has_image, cor,
        altura, largura, is_custom, total_count
      FROM final
    ) t
  $q$, v_xbz_where, v_custom_where, '%', '%', '%', '%');

  EXECUTE v_sql INTO v_rows, v_total USING v_term, v_limit, v_offset;

  RETURN json_build_object('rows', v_rows, 'total_count', v_total);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.sistema_search_products(text, integer, integer) TO authenticated, service_role;
