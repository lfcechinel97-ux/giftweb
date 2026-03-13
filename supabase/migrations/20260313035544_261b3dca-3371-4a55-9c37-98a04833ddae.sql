
CREATE OR REPLACE FUNCTION public.set_variantes_por_prefixo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Reset all
  UPDATE products_cache SET produto_pai = NULL, is_variante = false, variantes = NULL;

  -- Pick the parent: the row with the shortest codigo_amigavel per prefix group (ties broken alphabetically)
  -- Mark all OTHER rows in that group as variants
  UPDATE products_cache v
  SET 
    produto_pai = parent.id,
    is_variante = true
  FROM (
    SELECT DISTINCT ON (codigo_prefixo) id, codigo_prefixo, codigo_amigavel
    FROM products_cache
    WHERE codigo_prefixo IS NOT NULL
    ORDER BY codigo_prefixo, length(codigo_amigavel), codigo_amigavel
  ) parent
  WHERE
    v.codigo_prefixo = parent.codigo_prefixo
    AND v.id <> parent.id
    AND v.codigo_prefixo IS NOT NULL;

  -- Build variantes JSONB on each parent
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
$$;

-- Run it
SELECT set_variantes_por_prefixo();
