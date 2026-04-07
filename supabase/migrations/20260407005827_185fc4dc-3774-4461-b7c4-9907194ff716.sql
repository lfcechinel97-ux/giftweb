-- 1. Normalizar codigo_prefixo legado
UPDATE products_cache
SET codigo_prefixo = 
  CASE 
    WHEN codigo_prefixo LIKE '%|%' THEN split_part(codigo_prefixo, '|', 1)
    WHEN codigo_prefixo IS NULL THEN split_part(codigo_amigavel, '-', 1)
    ELSE codigo_prefixo
  END
WHERE codigo_prefixo LIKE '%|%' OR codigo_prefixo IS NULL;

-- 2. Recriar a RPC de vinculação (incremental, sem reset global)
CREATE OR REPLACE FUNCTION public.set_variantes_por_prefixo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
END;
$function$;

-- 3. Reativar pais desativados e executar agrupamento
UPDATE products_cache SET ativo = true WHERE codigo_amigavel IN ('18645L', '14726B', '14726L') AND ativo = false;

SELECT set_variantes_por_prefixo();