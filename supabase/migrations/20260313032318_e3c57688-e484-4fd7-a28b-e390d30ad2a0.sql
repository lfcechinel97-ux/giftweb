
CREATE OR REPLACE FUNCTION public.set_variantes_por_prefixo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  UPDATE products_cache SET produto_pai = NULL, is_variante = false WHERE is_variante = true;
  UPDATE products_cache SET variantes = NULL WHERE variantes IS NOT NULL;

  UPDATE products_cache v
  SET 
    produto_pai = p.id,
    is_variante = true
  FROM products_cache p
  WHERE
    v.codigo_prefixo = p.codigo_prefixo
    AND v.codigo_amigavel <> p.codigo_amigavel
    AND p.is_variante = false;

  UPDATE products_cache p
  SET variantes = sub.variantes_json
  FROM (
    SELECT 
      produto_pai,
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
