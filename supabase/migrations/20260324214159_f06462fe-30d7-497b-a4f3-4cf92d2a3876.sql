-- RPC 1: Search products by category (server-side JOIN + filtering)
CREATE OR REPLACE FUNCTION public.search_products_by_category(
  p_category_slug text,
  p_cor text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_apenas_estoque boolean DEFAULT false,
  p_sort text DEFAULT 'relevancia',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_rows json;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT count(*) INTO v_total
  FROM products_cache pc
  JOIN product_spotlight_categories psc ON psc.product_id = pc.id
  JOIN spotlight_categories sc ON sc.id = psc.category_id
  WHERE sc.slug = p_category_slug
    AND pc.ativo = true
    AND pc.has_image = true
    AND (p_cor IS NULL OR pc.cor = ANY(p_cor))
    AND (p_cor IS NOT NULL OR pc.is_variante = false)
    AND (p_search IS NULL OR pc.busca ILIKE '%' || p_search || '%')
    AND (NOT p_apenas_estoque OR COALESCE(pc.estoque, 0) > 0);

  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT pc.*
    FROM products_cache pc
    JOIN product_spotlight_categories psc ON psc.product_id = pc.id
    JOIN spotlight_categories sc ON sc.id = psc.category_id
    WHERE sc.slug = p_category_slug
      AND pc.ativo = true
      AND pc.has_image = true
      AND (p_cor IS NULL OR pc.cor = ANY(p_cor))
      AND (p_cor IS NOT NULL OR pc.is_variante = false)
      AND (p_search IS NULL OR pc.busca ILIKE '%' || p_search || '%')
      AND (NOT p_apenas_estoque OR COALESCE(pc.estoque, 0) > 0)
    ORDER BY
      CASE WHEN p_sort = 'menor_preco' THEN pc.preco_custo END ASC NULLS LAST,
      CASE WHEN p_sort = 'maior_preco' THEN pc.preco_custo END DESC NULLS LAST,
      CASE WHEN p_sort = 'maior_estoque' THEN pc.estoque END DESC NULLS LAST,
      CASE WHEN p_sort = 'az' THEN pc.nome END ASC,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.sort_estoque END ASC,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.variantes_count END DESC NULLS LAST,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.estoque END DESC NULLS LAST
    LIMIT p_page_size
    OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', v_total);
END;
$$;

-- RPC 2: Search products globally (no category)
CREATE OR REPLACE FUNCTION public.search_products_global(
  p_cor text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_apenas_estoque boolean DEFAULT false,
  p_sort text DEFAULT 'relevancia',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_rows json;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT count(*) INTO v_total
  FROM products_cache pc
  WHERE pc.ativo = true
    AND pc.has_image = true
    AND (p_cor IS NULL OR pc.cor = ANY(p_cor))
    AND (p_cor IS NOT NULL OR pc.is_variante = false)
    AND (p_search IS NULL OR pc.busca ILIKE '%' || p_search || '%')
    AND (NOT p_apenas_estoque OR COALESCE(pc.estoque, 0) > 0);

  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT pc.*
    FROM products_cache pc
    WHERE pc.ativo = true
      AND pc.has_image = true
      AND (p_cor IS NULL OR pc.cor = ANY(p_cor))
      AND (p_cor IS NOT NULL OR pc.is_variante = false)
      AND (p_search IS NULL OR pc.busca ILIKE '%' || p_search || '%')
      AND (NOT p_apenas_estoque OR COALESCE(pc.estoque, 0) > 0)
    ORDER BY
      CASE WHEN p_sort = 'menor_preco' THEN pc.preco_custo END ASC NULLS LAST,
      CASE WHEN p_sort = 'maior_preco' THEN pc.preco_custo END DESC NULLS LAST,
      CASE WHEN p_sort = 'maior_estoque' THEN pc.estoque END DESC NULLS LAST,
      CASE WHEN p_sort = 'az' THEN pc.nome END ASC,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.sort_estoque END ASC,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.variantes_count END DESC NULLS LAST,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.estoque END DESC NULLS LAST
    LIMIT p_page_size
    OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', v_total);
END;
$$;

-- RPC 3: Get available colors for a category
CREATE OR REPLACE FUNCTION public.get_category_colors(p_category_slug text)
RETURNS text[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_colors text[];
BEGIN
  SELECT array_agg(DISTINCT pc.cor ORDER BY pc.cor)
  INTO v_colors
  FROM products_cache pc
  JOIN product_spotlight_categories psc ON psc.product_id = pc.id
  JOIN spotlight_categories sc ON sc.id = psc.category_id
  WHERE sc.slug = p_category_slug
    AND pc.ativo = true
    AND pc.has_image = true
    AND pc.cor IS NOT NULL
    AND pc.cor != '';

  RETURN COALESCE(v_colors, ARRAY[]::text[]);
END;
$$;