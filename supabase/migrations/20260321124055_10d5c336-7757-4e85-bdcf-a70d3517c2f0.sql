CREATE OR REPLACE FUNCTION public.set_variantes_por_prefixo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Reset all linkage
  UPDATE products_cache SET produto_pai = NULL, is_variante = false, variantes = NULL, variantes_count = 1;

  -- Elect the parent within each codigo_prefixo group (formato: "CodigoAmigavel|nomeNormalizado").
  -- O pai é o produto com o codigo_amigavel mais curto do grupo (empate: ordem alfabética).
  -- Todos os outros membros do grupo viram variantes apontando para esse pai.
  UPDATE products_cache v
  SET
    produto_pai = parent.id,
    is_variante = true
  FROM (
    SELECT DISTINCT ON (g.codigo_prefixo) g.id, g.codigo_prefixo
    FROM products_cache g
    WHERE g.codigo_prefixo IS NOT NULL
      AND g.codigo_prefixo != ''
      AND EXISTS (
        SELECT 1 FROM products_cache p2
        WHERE p2.codigo_prefixo = g.codigo_prefixo
          AND p2.id != g.id
      )
    ORDER BY g.codigo_prefixo, length(g.codigo_amigavel), g.codigo_amigavel
  ) parent
  WHERE
    v.codigo_prefixo = parent.codigo_prefixo
    AND v.id != parent.id;

  -- Monta o array de variantes JSONB em cada produto pai
  UPDATE products_cache p
  SET variantes = sub.variantes_json,
      variantes_count = sub.cnt + 1
  FROM (
    SELECT
      produto_pai,
      count(*) AS cnt,
      jsonb_agg(
        jsonb_build_object(
          'slug', slug,
          'cor', cor,
          'image', image_url,
          'estoque', estoque,
          'codigo_amigavel', codigo_amigavel
        ) ORDER BY codigo_amigavel
      ) AS variantes_json
    FROM products_cache
    WHERE produto_pai IS NOT NULL AND is_variante = true
    GROUP BY produto_pai
  ) sub
  WHERE p.id = sub.produto_pai;
END;
$function$;