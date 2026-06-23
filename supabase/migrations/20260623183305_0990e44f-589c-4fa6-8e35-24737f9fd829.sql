-- Indexes for hot paths in /sistema and /catalogo
CREATE INDEX IF NOT EXISTS idx_pc_sistema_ativo_codigo
  ON public.products_cache (codigo_amigavel ASC)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_pc_sistema_prefixo_codigo
  ON public.products_cache (codigo_prefixo, codigo_amigavel ASC)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_pc_sistema_busca_trgm
  ON public.products_cache USING gin (busca gin_trgm_ops)
  WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_pc_catalog_colors
  ON public.products_cache (cor)
  WHERE ativo = true AND has_image = true AND cor IS NOT NULL AND cor <> '';

CREATE INDEX IF NOT EXISTS idx_sistema_orcamentos_vendedor_created
  ON public.sistema_orcamentos (vendedor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sistema_orcamentos_created
  ON public.sistema_orcamentos (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sistema_clientes_nome
  ON public.sistema_clientes (nome ASC);

CREATE INDEX IF NOT EXISTS idx_sistema_vendedores_nome
  ON public.sistema_vendedores (nome ASC);

CREATE INDEX IF NOT EXISTS idx_sistema_meios_pagamento_nome
  ON public.sistema_meios_pagamento (nome ASC);

CREATE INDEX IF NOT EXISTS idx_sistema_transportadoras_nome
  ON public.sistema_transportadoras (nome ASC);

CREATE INDEX IF NOT EXISTS idx_sistema_origens_nome
  ON public.sistema_origens (nome ASC);

-- Compact color list for /catalogo filters
CREATE OR REPLACE FUNCTION public.get_catalog_filter_colors()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
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

-- Base categories plus one representative image in a single request
CREATE OR REPLACE FUNCTION public.get_catalog_story_categories()
RETURNS TABLE(slug text, label text, category_position integer, image_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
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

-- Fast, admin-only product search for the sales system: returns one representative per product prefix
CREATE OR REPLACE FUNCTION public.sistema_search_products(
  p_search text DEFAULT NULL::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 60
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_rows json;
  v_term text;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_offset := GREATEST(COALESCE(p_page, 1), 1) - 1;
  v_offset := v_offset * LEAST(GREATEST(COALESCE(p_page_size, 60), 1), 100);
  v_term := NULLIF(trim(COALESCE(p_search, '')), '');

  WITH filtered AS (
    SELECT
      pc.*,
      COALESCE(NULLIF(pc.codigo_prefixo, ''), split_part(pc.codigo_amigavel, '-', 1), pc.codigo_amigavel) AS group_key
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND (
        v_term IS NULL
        OR pc.nome ILIKE '%' || v_term || '%'
        OR pc.codigo_amigavel ILIKE '%' || v_term || '%'
        OR pc.busca ILIKE '%' || v_term || '%'
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
        OR pc.nome ILIKE '%' || v_term || '%'
        OR pc.codigo_amigavel ILIKE '%' || v_term || '%'
        OR pc.busca ILIKE '%' || v_term || '%'
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
      altura, largura
    FROM ranked
    WHERE rn = 1
    ORDER BY codigo_amigavel ASC
    LIMIT LEAST(GREATEST(COALESCE(p_page_size, 60), 1), 100)
    OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', COALESCE(v_total, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.sistema_search_products(text, integer, integer) TO authenticated, service_role;

-- Fast, admin-only product group fetch for variants/details in the sales system
CREATE OR REPLACE FUNCTION public.sistema_get_product_group(p_codigo text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_codigo text;
  v_prefix text;
  v_parent_id uuid;
  v_rows json;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_codigo := trim(COALESCE(p_codigo, ''));
  IF v_codigo = '' THEN
    RETURN '[]'::json;
  END IF;

  SELECT
    COALESCE(NULLIF(pc.codigo_prefixo, ''), split_part(pc.codigo_amigavel, '-', 1), pc.codigo_amigavel),
    COALESCE(pc.produto_pai, pc.id)
  INTO v_prefix, v_parent_id
  FROM public.products_cache pc
  WHERE pc.ativo = true
    AND (pc.codigo_amigavel = v_codigo OR pc.id::text = v_codigo OR pc.codigo_prefixo = v_codigo)
  ORDER BY COALESCE(pc.is_variante, false) ASC, length(pc.codigo_amigavel), pc.codigo_amigavel ASC
  LIMIT 1;

  IF v_prefix IS NULL THEN
    v_prefix := split_part(v_codigo, '-', 1);
  END IF;

  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      pc.id, pc.nome, pc.slug, pc.codigo_amigavel, pc.codigo_prefixo, pc.image_url, pc.image_urls,
      pc.preco_custo, pc.estoque, pc.estoque_total, pc.categoria, pc.tabela_precos, pc.variantes,
      pc.variantes_count, pc.is_variante, pc.is_hidden, pc.produto_pai, pc.ativo, pc.has_image, pc.cor,
      pc.altura, pc.largura
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND (
        COALESCE(NULLIF(pc.codigo_prefixo, ''), split_part(pc.codigo_amigavel, '-', 1), pc.codigo_amigavel) = v_prefix
        OR pc.produto_pai = v_parent_id
        OR pc.id = v_parent_id
      )
    ORDER BY COALESCE(pc.is_variante, false) ASC, length(pc.codigo_amigavel), pc.codigo_amigavel ASC
    LIMIT 200
  ) t;

  RETURN COALESCE(v_rows, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sistema_get_product_group(text) TO authenticated, service_role;