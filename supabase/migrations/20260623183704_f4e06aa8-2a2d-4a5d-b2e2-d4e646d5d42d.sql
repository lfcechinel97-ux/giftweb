CREATE OR REPLACE FUNCTION public.get_catalog_filter_colors()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(array_agg(cor ORDER BY cor), ARRAY[]::text[])
  FROM (
    SELECT DISTINCT pc.cor
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND pc.has_image = true
      AND (pc.is_hidden IS NULL OR pc.is_hidden = false)
      AND pc.cor IS NOT NULL
      AND pc.cor <> ''
  ) colors;
$$;

GRANT EXECUTE ON FUNCTION public.get_catalog_filter_colors() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_catalog_story_categories()
RETURNS TABLE(slug text, label text, category_position integer, image_url text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $$
  SELECT
    sc.slug,
    sc.label,
    sc.position AS category_position,
    COALESCE(by_relation.image_url, by_text.image_url) AS image_url
  FROM public.spotlight_categories sc
  LEFT JOIN LATERAL (
    SELECT pc.image_url
    FROM public.product_spotlight_categories psc
    JOIN public.products_cache pc ON pc.id = psc.product_id
    WHERE psc.category_id = sc.id
      AND pc.ativo = true
      AND pc.has_image = true
      AND (pc.is_hidden IS NULL OR pc.is_hidden = false)
      AND pc.image_url IS NOT NULL
      AND pc.image_url <> ''
    ORDER BY pc.sort_estoque ASC NULLS LAST, pc.estoque_total DESC NULLS LAST, pc.estoque DESC NULLS LAST
    LIMIT 1
  ) by_relation ON true
  LEFT JOIN LATERAL (
    SELECT pc.image_url
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND pc.has_image = true
      AND (pc.is_hidden IS NULL OR pc.is_hidden = false)
      AND pc.image_url IS NOT NULL
      AND pc.image_url <> ''
      AND (pc.categoria ILIKE '%' || sc.slug || '%' OR pc.categoria_manual ILIKE '%' || sc.slug || '%')
    ORDER BY pc.sort_estoque ASC NULLS LAST, pc.estoque_total DESC NULLS LAST, pc.estoque DESC NULLS LAST
    LIMIT 1
  ) by_text ON true
  WHERE sc.category_type = 'base'
    AND sc.active = true
  ORDER BY sc.label ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_catalog_story_categories() TO anon, authenticated, service_role;