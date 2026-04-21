-- 1. Add estoque_total column
ALTER TABLE public.products_cache
ADD COLUMN IF NOT EXISTS estoque_total integer DEFAULT 0;

-- 2. Function to recalculate estoque_total for a single product (parent or standalone)
CREATE OR REPLACE FUNCTION public.recalc_estoque_total(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_self integer;
  v_children integer;
BEGIN
  SELECT COALESCE(estoque, 0) INTO v_self FROM products_cache WHERE id = p_id;
  IF v_self IS NULL THEN RETURN; END IF;

  SELECT COALESCE(SUM(COALESCE(estoque, 0)), 0)
  INTO v_children
  FROM products_cache
  WHERE produto_pai = p_id AND is_variante = true;

  UPDATE products_cache
  SET estoque_total = v_self + v_children,
      sort_estoque = CASE WHEN (v_self + v_children) > 0 THEN 0 ELSE 1 END
  WHERE id = p_id;
END;
$$;

-- 3. Trigger function: keep estoque_total in sync on row changes
CREATE OR REPLACE FUNCTION public.trg_estoque_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Set estoque_total for the current row first (own stock; parents will be recalculated below)
  NEW.estoque_total := COALESCE(NEW.estoque, 0);
  NEW.sort_estoque := CASE WHEN COALESCE(NEW.estoque_total, 0) > 0 THEN 0 ELSE 1 END;
  RETURN NEW;
END;
$$;

-- 4. After-trigger: recalculate parent aggregate when a variant changes
CREATE OR REPLACE FUNCTION public.trg_estoque_total_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If this row is a variant, recalc its parent
  IF NEW.is_variante = true AND NEW.produto_pai IS NOT NULL THEN
    PERFORM public.recalc_estoque_total(NEW.produto_pai);
  END IF;

  -- If this row is a parent (has children), recalc itself to aggregate
  IF NEW.is_variante = false THEN
    PERFORM public.recalc_estoque_total(NEW.id);
  END IF;

  -- If produto_pai changed (variant moved), recalc the previous parent too
  IF TG_OP = 'UPDATE' AND OLD.produto_pai IS NOT NULL AND OLD.produto_pai IS DISTINCT FROM NEW.produto_pai THEN
    PERFORM public.recalc_estoque_total(OLD.produto_pai);
  END IF;

  RETURN NULL;
END;
$$;

-- 5. Drop legacy sort_estoque trigger if it exists (we now handle it inside the new triggers)
DROP TRIGGER IF EXISTS update_sort_estoque_trigger ON public.products_cache;
DROP TRIGGER IF EXISTS set_sort_estoque ON public.products_cache;

-- 6. Attach new triggers
DROP TRIGGER IF EXISTS estoque_total_before ON public.products_cache;
CREATE TRIGGER estoque_total_before
BEFORE INSERT OR UPDATE OF estoque, produto_pai, is_variante
ON public.products_cache
FOR EACH ROW
EXECUTE FUNCTION public.trg_estoque_total();

DROP TRIGGER IF EXISTS estoque_total_after ON public.products_cache;
CREATE TRIGGER estoque_total_after
AFTER INSERT OR UPDATE OF estoque, produto_pai, is_variante
ON public.products_cache
FOR EACH ROW
EXECUTE FUNCTION public.trg_estoque_total_after();

-- 7. Backfill: set base estoque_total = own stock
UPDATE public.products_cache
SET estoque_total = COALESCE(estoque, 0);

-- 8. Backfill: aggregate parents (own stock + sum of variant stock)
UPDATE public.products_cache p
SET estoque_total = COALESCE(p.estoque, 0) + COALESCE(sub.total, 0),
    sort_estoque = CASE WHEN (COALESCE(p.estoque, 0) + COALESCE(sub.total, 0)) > 0 THEN 0 ELSE 1 END
FROM (
  SELECT produto_pai, SUM(COALESCE(estoque, 0))::int AS total
  FROM public.products_cache
  WHERE produto_pai IS NOT NULL AND is_variante = true
  GROUP BY produto_pai
) sub
WHERE p.id = sub.produto_pai;

-- 9. Index for sort_estoque/estoque_total filtering
CREATE INDEX IF NOT EXISTS idx_products_cache_estoque_total ON public.products_cache (estoque_total);

-- 10. Update set_variantes_por_prefixo to refresh estoque_total at end
CREATE OR REPLACE FUNCTION public.set_variantes_por_prefixo()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CREATE TEMP TABLE tmp_parents ON COMMIT DROP AS
  SELECT DISTINCT ON (g.codigo_prefixo) g.id, g.codigo_prefixo
  FROM products_cache g
  WHERE g.codigo_prefixo IS NOT NULL AND g.codigo_prefixo != ''
    AND EXISTS (
      SELECT 1 FROM products_cache p2 
      WHERE p2.codigo_prefixo = g.codigo_prefixo AND p2.id != g.id
    )
  ORDER BY g.codigo_prefixo, g.ativo DESC, length(g.codigo_amigavel), g.codigo_amigavel;

  UPDATE products_cache pc
  SET produto_pai = NULL, is_variante = false, variantes = NULL, variantes_count = 1
  WHERE (pc.produto_pai IS NOT NULL OR pc.is_variante = true OR pc.variantes IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM tmp_parents tp WHERE tp.codigo_prefixo = pc.codigo_prefixo
    );

  UPDATE products_cache v
  SET produto_pai = parent.id, is_variante = true
  FROM tmp_parents parent
  WHERE v.codigo_prefixo = parent.codigo_prefixo
    AND v.id != parent.id
    AND (v.produto_pai IS DISTINCT FROM parent.id OR v.is_variante = false);

  UPDATE products_cache p
  SET is_variante = false, produto_pai = NULL
  FROM tmp_parents parent
  WHERE p.id = parent.id
    AND (p.is_variante = true OR p.produto_pai IS NOT NULL);

  UPDATE products_cache p
  SET variantes = sub.variantes_json,
      variantes_count = sub.cnt + 1
  FROM (
    SELECT
      produto_pai,
      count(*) AS cnt,
      jsonb_agg(
        jsonb_build_object(
          'slug', slug, 'cor', cor, 'image', image_url, 'estoque', estoque, 'codigo_amigavel', codigo_amigavel
        ) ORDER BY codigo_amigavel
      ) AS variantes_json
    FROM products_cache
    WHERE produto_pai IS NOT NULL AND is_variante = true
    GROUP BY produto_pai
  ) sub
  WHERE p.id = sub.produto_pai;

  -- Recalculate estoque_total for all parents after grouping
  UPDATE products_cache p
  SET estoque_total = COALESCE(p.estoque, 0) + COALESCE(sub.total, 0),
      sort_estoque = CASE WHEN (COALESCE(p.estoque, 0) + COALESCE(sub.total, 0)) > 0 THEN 0 ELSE 1 END
  FROM (
    SELECT produto_pai, SUM(COALESCE(estoque, 0))::int AS total
    FROM products_cache
    WHERE produto_pai IS NOT NULL AND is_variante = true
    GROUP BY produto_pai
  ) sub
  WHERE p.id = sub.produto_pai;
END;
$$;

-- 11. Update search RPCs to use estoque_total
CREATE OR REPLACE FUNCTION public.search_products_by_category(p_category_slug text, p_cor text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_apenas_estoque boolean DEFAULT false, p_sort text DEFAULT 'relevancia'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20, p_preco_min numeric DEFAULT NULL::numeric, p_preco_max numeric DEFAULT NULL::numeric)
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
    AND (NOT p_apenas_estoque OR COALESCE(pc.estoque_total, 0) > 0)
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
      AND (NOT p_apenas_estoque OR COALESCE(pc.estoque_total, 0) > 0)
      AND (p_preco_min IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) >= p_preco_min)
      AND (p_preco_max IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) <= p_preco_max)
    ORDER BY
      CASE WHEN p_sort = 'menor_preco' THEN pc.preco_custo END ASC NULLS LAST,
      CASE WHEN p_sort = 'maior_preco' THEN pc.preco_custo END DESC NULLS LAST,
      CASE WHEN p_sort = 'maior_estoque' THEN pc.estoque_total END DESC NULLS LAST,
      CASE WHEN p_sort = 'az' THEN pc.nome END ASC,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.sort_estoque END ASC,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.variantes_count END DESC NULLS LAST,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.estoque_total END DESC NULLS LAST
    LIMIT p_page_size
    OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', v_total);
END;
$function$;

CREATE OR REPLACE FUNCTION public.search_products_global(p_cor text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text, p_apenas_estoque boolean DEFAULT false, p_sort text DEFAULT 'relevancia'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 20, p_preco_min numeric DEFAULT NULL::numeric, p_preco_max numeric DEFAULT NULL::numeric)
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
    AND (NOT p_apenas_estoque OR COALESCE(pc.estoque_total, 0) > 0)
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
      AND (NOT p_apenas_estoque OR COALESCE(pc.estoque_total, 0) > 0)
      AND (p_preco_min IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) >= p_preco_min)
      AND (p_preco_max IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) <= p_preco_max)
    ORDER BY
      CASE WHEN p_sort = 'menor_preco' THEN pc.preco_custo END ASC NULLS LAST,
      CASE WHEN p_sort = 'maior_preco' THEN pc.preco_custo END DESC NULLS LAST,
      CASE WHEN p_sort = 'maior_estoque' THEN pc.estoque_total END DESC NULLS LAST,
      CASE WHEN p_sort = 'az' THEN pc.nome END ASC,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.sort_estoque END ASC,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.variantes_count END DESC NULLS LAST,
      CASE WHEN p_sort = 'relevancia' OR p_sort IS NULL THEN pc.estoque_total END DESC NULLS LAST
    LIMIT p_page_size
    OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', v_total);
END;
$function$;