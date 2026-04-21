CREATE OR REPLACE FUNCTION public.admin_search_products(
  p_search text DEFAULT NULL,
  p_category_slug text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_page integer DEFAULT 0,
  p_page_size integer DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_rows json;
BEGIN
  -- Restrict to admins
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_offset := p_page * p_page_size;

  SELECT count(*) INTO v_total
  FROM products_cache pc
  WHERE pc.is_variante = false
    AND pc.ativo = true
    AND (p_search IS NULL OR p_search = '' OR pc.nome ILIKE '%' || p_search || '%' OR pc.codigo_amigavel ILIKE '%' || p_search || '%')
    AND (p_category_slug IS NULL OR p_category_slug = '' OR EXISTS (
      SELECT 1 FROM product_spotlight_categories psc
      JOIN spotlight_categories sc ON sc.id = psc.category_id
      WHERE psc.product_id = pc.id AND sc.slug = p_category_slug
    ))
    AND (
      p_status = 'all'
      OR (p_status = 'featured' AND pc.is_featured = true)
      OR (p_status = 'hidden' AND pc.is_hidden = true)
      OR (p_status = 'active' AND (pc.is_hidden IS NULL OR pc.is_hidden = false))
    );

  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT pc.id, pc.nome, pc.slug, pc.image_url, pc.codigo_amigavel, pc.categoria,
           pc.preco_custo, pc.estoque, pc.is_featured, pc.is_hidden, pc.variantes_count,
           pc.tabela_precos
    FROM products_cache pc
    WHERE pc.is_variante = false
      AND pc.ativo = true
      AND (p_search IS NULL OR p_search = '' OR pc.nome ILIKE '%' || p_search || '%' OR pc.codigo_amigavel ILIKE '%' || p_search || '%')
      AND (p_category_slug IS NULL OR p_category_slug = '' OR EXISTS (
        SELECT 1 FROM product_spotlight_categories psc
        JOIN spotlight_categories sc ON sc.id = psc.category_id
        WHERE psc.product_id = pc.id AND sc.slug = p_category_slug
      ))
      AND (
        p_status = 'all'
        OR (p_status = 'featured' AND pc.is_featured = true)
        OR (p_status = 'hidden' AND pc.is_hidden = true)
        OR (p_status = 'active' AND (pc.is_hidden IS NULL OR pc.is_hidden = false))
      )
    ORDER BY pc.nome ASC
    LIMIT p_page_size
    OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', v_total);
END;
$$;