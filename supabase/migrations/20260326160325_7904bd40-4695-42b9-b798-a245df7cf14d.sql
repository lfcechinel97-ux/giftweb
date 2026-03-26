
-- Helper function to compute display price from preco_custo
CREATE OR REPLACE FUNCTION public.calc_display_price(p_preco_custo numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_preco_custo * (
    CASE
      WHEN p_preco_custo <= 1 THEN 6.0
      WHEN p_preco_custo <= 3 THEN 4.8
      WHEN p_preco_custo <= 8 THEN 3.8
      WHEN p_preco_custo <= 15 THEN 3.0
      WHEN p_preco_custo <= 25 THEN 2.5
      WHEN p_preco_custo <= 40 THEN 2.1
      WHEN p_preco_custo <= 70 THEN 1.8
      ELSE 1.6
    END
  ) * (1 - 0.16);
$$;

-- Update search_products_by_category with price params
CREATE OR REPLACE FUNCTION public.search_products_by_category(
  p_category_slug text,
  p_cor text[] DEFAULT NULL::text[],
  p_search text DEFAULT NULL::text,
  p_apenas_estoque boolean DEFAULT false,
  p_sort text DEFAULT 'relevancia'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_preco_min numeric DEFAULT NULL,
  p_preco_max numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    AND (pc.is_hidden IS NULL OR pc.is_hidden = false)
    AND (p_cor IS NULL OR pc.cor = ANY(p_cor))
    AND (p_cor IS NOT NULL OR pc.is_variante = false)
    AND (p_search IS NULL OR pc.busca ILIKE '%' || p_search || '%')
    AND (NOT p_apenas_estoque OR COALESCE(pc.estoque, 0) > 0)
    AND (p_preco_min IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) >= p_preco_min)
    AND (p_preco_max IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) <= p_preco_max);

  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT pc.*
    FROM products_cache pc
    JOIN product_spotlight_categories psc ON psc.product_id = pc.id
    JOIN spotlight_categories sc ON sc.id = psc.category_id
    WHERE sc.slug = p_category_slug
      AND pc.ativo = true
      AND pc.has_image = true
      AND (pc.is_hidden IS NULL OR pc.is_hidden = false)
      AND (p_cor IS NULL OR pc.cor = ANY(p_cor))
      AND (p_cor IS NOT NULL OR pc.is_variante = false)
      AND (p_search IS NULL OR pc.busca ILIKE '%' || p_search || '%')
      AND (NOT p_apenas_estoque OR COALESCE(pc.estoque, 0) > 0)
      AND (p_preco_min IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) >= p_preco_min)
      AND (p_preco_max IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) <= p_preco_max)
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
$function$;

-- Update search_products_global with price params
CREATE OR REPLACE FUNCTION public.search_products_global(
  p_cor text[] DEFAULT NULL::text[],
  p_search text DEFAULT NULL::text,
  p_apenas_estoque boolean DEFAULT false,
  p_sort text DEFAULT 'relevancia'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_preco_min numeric DEFAULT NULL,
  p_preco_max numeric DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    AND (pc.is_hidden IS NULL OR pc.is_hidden = false)
    AND (p_cor IS NULL OR pc.cor = ANY(p_cor))
    AND (p_cor IS NOT NULL OR pc.is_variante = false)
    AND (p_search IS NULL OR pc.busca ILIKE '%' || p_search || '%')
    AND (NOT p_apenas_estoque OR COALESCE(pc.estoque, 0) > 0)
    AND (p_preco_min IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) >= p_preco_min)
    AND (p_preco_max IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) <= p_preco_max);

  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT pc.*
    FROM products_cache pc
    WHERE pc.ativo = true
      AND pc.has_image = true
      AND (pc.is_hidden IS NULL OR pc.is_hidden = false)
      AND (p_cor IS NULL OR pc.cor = ANY(p_cor))
      AND (p_cor IS NOT NULL OR pc.is_variante = false)
      AND (p_search IS NULL OR pc.busca ILIKE '%' || p_search || '%')
      AND (NOT p_apenas_estoque OR COALESCE(pc.estoque, 0) > 0)
      AND (p_preco_min IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) >= p_preco_min)
      AND (p_preco_max IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) <= p_preco_max)
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
$function$;
