
-- Tabela de produtos customizados do sistema (separada da products_cache)
CREATE TABLE public.sistema_produtos_custom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text NOT NULL UNIQUE,
  preco_custo numeric(12,2) NOT NULL DEFAULT 0,
  estoque integer NOT NULL DEFAULT 0,
  image_url text,
  cor text,
  categoria text,
  observacoes text,
  parent_id uuid REFERENCES public.sistema_produtos_custom(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_produtos_custom TO authenticated;
GRANT ALL ON public.sistema_produtos_custom TO service_role;

ALTER TABLE public.sistema_produtos_custom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage custom products"
  ON public.sistema_produtos_custom
  FOR ALL
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE INDEX idx_sistema_produtos_custom_parent ON public.sistema_produtos_custom(parent_id);
CREATE INDEX idx_sistema_produtos_custom_busca ON public.sistema_produtos_custom USING gin ((lower(nome || ' ' || codigo || ' ' || COALESCE(cor,'') || ' ' || COALESCE(categoria,''))) gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.sistema_produtos_custom_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_sistema_produtos_custom_updated
  BEFORE UPDATE ON public.sistema_produtos_custom
  FOR EACH ROW EXECUTE FUNCTION public.sistema_produtos_custom_set_updated_at();

-- Storage policies: admins gerenciam arquivos no prefixo sistema-produtos/ do bucket site-images
CREATE POLICY "Admins upload sistema-produtos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-images' AND (storage.foldername(name))[1] = 'sistema-produtos' AND public.is_admin_user());

CREATE POLICY "Admins update sistema-produtos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'site-images' AND (storage.foldername(name))[1] = 'sistema-produtos' AND public.is_admin_user());

CREATE POLICY "Admins delete sistema-produtos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'site-images' AND (storage.foldername(name))[1] = 'sistema-produtos' AND public.is_admin_user());

-- Atualiza sistema_search_products para incluir produtos customizados
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
      pc.id, pc.nome, pc.slug, pc.codigo_amigavel, pc.codigo_prefixo, pc.image_url, pc.image_urls,
      pc.preco_custo, pc.estoque, pc.estoque_total, pc.categoria, pc.tabela_precos, pc.variantes,
      pc.variantes_count, pc.is_variante, pc.is_hidden, pc.produto_pai, pc.ativo, pc.has_image, pc.cor,
      pc.altura, pc.largura,
      false AS is_custom,
      COALESCE(NULLIF(pc.codigo_prefixo, ''), split_part(pc.codigo_amigavel, '-', 1), pc.codigo_amigavel) AS group_key
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND (
        v_term IS NULL
        OR pc.codigo_amigavel ILIKE '%' || v_term || '%'
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
      NULL::jsonb AS image_urls,
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
      COALESCE(cp.parent_id::text, cp.id::text) AS group_key
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
        ORDER BY COALESCE(is_variante, false) ASC, length(codigo_amigavel), codigo_amigavel ASC
      ) AS rn
    FROM unioned u
  )
  SELECT count(*) INTO v_total FROM ranked WHERE rn = 1;

  WITH xbz AS (
    SELECT
      pc.id, pc.nome, pc.slug, pc.codigo_amigavel, pc.codigo_prefixo, pc.image_url, pc.image_urls,
      pc.preco_custo, pc.estoque, pc.estoque_total, pc.categoria, pc.tabela_precos, pc.variantes,
      pc.variantes_count, pc.is_variante, pc.is_hidden, pc.produto_pai, pc.ativo, pc.has_image, pc.cor,
      pc.altura, pc.largura,
      false AS is_custom,
      COALESCE(NULLIF(pc.codigo_prefixo, ''), split_part(pc.codigo_amigavel, '-', 1), pc.codigo_amigavel) AS group_key
    FROM public.products_cache pc
    WHERE pc.ativo = true
      AND (
        v_term IS NULL
        OR pc.codigo_amigavel ILIKE '%' || v_term || '%'
        OR (
          v_tokens IS NOT NULL AND array_length(v_tokens, 1) > 0
          AND NOT EXISTS (SELECT 1 FROM unnest(v_tokens) tk WHERE pc.busca NOT ILIKE '%' || tk || '%')
        )
      )
  ), custom AS (
    SELECT
      cp.id, cp.nome, NULL::text AS slug, cp.codigo AS codigo_amigavel, NULL::text AS codigo_prefixo,
      cp.image_url, NULL::jsonb AS image_urls, cp.preco_custo, cp.estoque, cp.estoque AS estoque_total,
      cp.categoria, NULL::jsonb AS tabela_precos, NULL::jsonb AS variantes,
      (1 + (SELECT count(*) FROM public.sistema_produtos_custom v WHERE v.parent_id = cp.id))::int AS variantes_count,
      (cp.parent_id IS NOT NULL) AS is_variante, false AS is_hidden, cp.parent_id AS produto_pai,
      true AS ativo, (cp.image_url IS NOT NULL AND cp.image_url <> '') AS has_image, cp.cor,
      NULL::numeric AS altura, NULL::numeric AS largura, true AS is_custom,
      COALESCE(cp.parent_id::text, cp.id::text) AS group_key
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
    SELECT * FROM xbz UNION ALL SELECT * FROM custom
  ), ranked AS (
    SELECT u.*,
      row_number() OVER (
        PARTITION BY group_key, is_custom
        ORDER BY COALESCE(is_variante, false) ASC, length(codigo_amigavel), codigo_amigavel ASC
      ) AS rn
    FROM unioned u
  )
  SELECT json_agg(row_to_json(t)) INTO v_rows
  FROM (
    SELECT
      id, nome, slug, codigo_amigavel, codigo_prefixo, image_url, image_urls,
      preco_custo, estoque, estoque_total, categoria, tabela_precos, variantes,
      variantes_count, is_variante, is_hidden, produto_pai, ativo, has_image, cor,
      altura, largura, is_custom,
      CASE
        WHEN v_term IS NOT NULL AND nome ILIKE v_term || '%' THEN 0
        WHEN v_term IS NOT NULL AND nome ILIKE '%' || v_term || '%' THEN 1
        ELSE 2
      END AS _rank
    FROM ranked
    WHERE rn = 1
    ORDER BY _rank ASC, codigo_amigavel ASC
    LIMIT v_limit OFFSET v_offset
  ) t;

  RETURN json_build_object('rows', COALESCE(v_rows, '[]'::json), 'total_count', COALESCE(v_total, 0));
END;
$function$;

-- RPCs para gerenciar produtos customizados
CREATE OR REPLACE FUNCTION public.sistema_list_custom_products()
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows json;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT json_agg(row_to_json(t) ORDER BY t.created_at DESC) INTO v_rows
  FROM (
    SELECT cp.*,
      (SELECT count(*) FROM public.sistema_produtos_custom v WHERE v.parent_id = cp.id) AS variantes_count
    FROM public.sistema_produtos_custom cp
    WHERE cp.parent_id IS NULL
  ) t;
  RETURN COALESCE(v_rows, '[]'::json);
END; $$;

CREATE OR REPLACE FUNCTION public.sistema_get_custom_product_variants(p_parent_id uuid)
RETURNS json LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_rows json;
BEGIN
  IF NOT public.is_admin_user() THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT json_agg(row_to_json(t) ORDER BY t.codigo) INTO v_rows
  FROM (SELECT * FROM public.sistema_produtos_custom WHERE parent_id = p_parent_id) t;
  RETURN COALESCE(v_rows, '[]'::json);
END; $$;
