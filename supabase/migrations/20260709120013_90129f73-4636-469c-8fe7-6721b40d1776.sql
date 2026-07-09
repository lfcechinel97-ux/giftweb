
-- 1. Coleções temáticas de produtos
CREATE TABLE public.product_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  nome text NOT NULL,
  titulo_destaque text,
  descricao text,
  cor_destaque text DEFAULT '217 91% 60%',
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_collections TO anon, authenticated;
GRANT ALL ON public.product_collections TO service_role;

ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read collections" ON public.product_collections
  FOR SELECT USING (true);
CREATE POLICY "admins manage collections" ON public.product_collections
  FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 2. Itens da coleção (por prefixo do código)
CREATE TABLE public.product_collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.product_collections(id) ON DELETE CASCADE,
  codigo_prefixo text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (collection_id, codigo_prefixo)
);
CREATE INDEX product_collection_items_prefix_idx
  ON public.product_collection_items (upper(codigo_prefixo));

GRANT SELECT ON public.product_collection_items TO anon, authenticated;
GRANT ALL ON public.product_collection_items TO service_role;

ALTER TABLE public.product_collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read collection items" ON public.product_collection_items
  FOR SELECT USING (true);
CREATE POLICY "admins manage collection items" ON public.product_collection_items
  FOR ALL TO authenticated
  USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- 3. Seed: coleção Dia dos Pais + prefixos
INSERT INTO public.product_collections (slug, nome, titulo_destaque, descricao, cor_destaque, ordem)
VALUES (
  'dia-dos-pais',
  'Dia dos Pais',
  'Dia dos Pais',
  'Brindes selecionados para presentear pais e clientes especiais neste Dia dos Pais.',
  '217 91% 60%',
  1
);

WITH col AS (SELECT id FROM public.product_collections WHERE slug='dia-dos-pais')
INSERT INTO public.product_collection_items (collection_id, codigo_prefixo)
SELECT (SELECT id FROM col), p
FROM unnest(ARRAY[
  '9353','9237','9250','9251','9305','19119','19145','2093','9190','9238',
  '9240','9282','9286','9288','19076','19082','01336','9054','19057','1320',
  '3040','3493','4052','4070','5013','7392','7447','8227','12926','18539',
  '18601','18645L','KIT18639','5036','18623','19022','7020','11870','14046','18673',
  '19013','19039','6040B','10071G','13474','8124','6093','10385','10889','18894',
  '1495','6757','7032','8130','8298','10124','10127','10390','18599','18895'
]) AS p;

-- 4. RPC de busca por coleção
CREATE OR REPLACE FUNCTION public.search_products_by_collection(
  p_collection_slug text,
  p_cor text[] DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_apenas_estoque boolean DEFAULT false,
  p_sort text DEFAULT 'relevancia',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_preco_min numeric DEFAULT NULL,
  p_preco_max numeric DEFAULT NULL
) RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_offset integer;
  v_total bigint;
  v_rows json;
  v_collection_id uuid;
BEGIN
  v_offset := (p_page - 1) * p_page_size;
  SELECT id INTO v_collection_id FROM public.product_collections WHERE slug = p_collection_slug AND ativo = true;
  IF v_collection_id IS NULL THEN
    RETURN json_build_object('rows', '[]'::json, 'total_count', 0);
  END IF;

  WITH prefixes AS (
    SELECT upper(codigo_prefixo) AS p
    FROM public.product_collection_items
    WHERE collection_id = v_collection_id
  ), matched AS (
    SELECT pc.*
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND pc.has_image = true
      AND (pc.is_hidden IS NULL OR pc.is_hidden = false)
      AND upper(COALESCE(NULLIF(pc.codigo_prefixo,''), split_part(pc.codigo_amigavel,'-',1))) IN (SELECT p FROM prefixes)
      AND (p_cor IS NULL OR pc.cor = ANY(p_cor))
      AND (p_cor IS NOT NULL OR pc.is_variante = false)
      AND (p_search IS NULL OR pc.busca ILIKE '%' || p_search || '%')
      AND (NOT p_apenas_estoque OR COALESCE(pc.estoque_total, 0) > 0)
      AND (p_preco_min IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) >= p_preco_min)
      AND (p_preco_max IS NULL OR calc_display_price(COALESCE(pc.preco_custo, 0)) <= p_preco_max)
  )
  SELECT count(*) INTO v_total FROM matched;

  WITH prefixes AS (
    SELECT upper(codigo_prefixo) AS p
    FROM public.product_collection_items
    WHERE collection_id = v_collection_id
  )
  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT pc.*
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND pc.has_image = true
      AND (pc.is_hidden IS NULL OR pc.is_hidden = false)
      AND upper(COALESCE(NULLIF(pc.codigo_prefixo,''), split_part(pc.codigo_amigavel,'-',1))) IN (SELECT p FROM prefixes)
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
    LIMIT p_page_size OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', v_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_products_by_collection(text, text[], text, boolean, text, integer, integer, numeric, numeric)
  TO anon, authenticated, service_role;
