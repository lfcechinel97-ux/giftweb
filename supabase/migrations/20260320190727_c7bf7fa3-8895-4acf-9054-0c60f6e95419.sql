
CREATE OR REPLACE FUNCTION public.set_variantes_por_prefixo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Reset all linkage
  UPDATE products_cache SET produto_pai = NULL, is_variante = false, variantes = NULL, variantes_count = 1;

  -- Step 0: Products with NULL/empty codigo_prefixo whose codigo_amigavel is a prefix of others
  -- → they ARE the parent. Temporarily treat them as self-referencing.
  UPDATE products_cache v
  SET
    produto_pai = parent.id,
    is_variante = true
  FROM (
    SELECT id, codigo_amigavel AS prefix
    FROM products_cache
    WHERE (codigo_prefixo IS NULL OR codigo_prefixo = '')
      AND EXISTS (
        SELECT 1 FROM products_cache p2
        WHERE p2.codigo_prefixo = products_cache.codigo_amigavel
      )
  ) parent
  WHERE
    v.codigo_prefixo = parent.prefix
    AND v.id != parent.id;

  -- Step 1: Products where codigo_amigavel = codigo_prefixo are also true parents.
  UPDATE products_cache v
  SET
    produto_pai = parent.id,
    is_variante = true
  FROM (
    SELECT id, codigo_amigavel AS prefix
    FROM products_cache
    WHERE codigo_prefixo IS NOT NULL
      AND codigo_prefixo != ''
      AND codigo_amigavel = codigo_prefixo
  ) parent
  WHERE
    v.codigo_prefixo = parent.prefix
    AND v.id != parent.id
    AND v.is_variante = false;

  -- Step 2: For remaining groups (no self-parent), elect shortest codigo_amigavel.
  UPDATE products_cache v
  SET
    produto_pai = parent.id,
    is_variante = true
  FROM (
    SELECT DISTINCT ON (g.codigo_prefixo) g.id, g.codigo_prefixo, g.codigo_amigavel
    FROM products_cache g
    WHERE g.codigo_prefixo IS NOT NULL
      AND g.codigo_prefixo != ''
      AND g.is_variante = false
      -- Skip groups that already have a parent elected (steps 0 or 1)
      AND NOT EXISTS (
        SELECT 1 FROM products_cache p2
        WHERE p2.codigo_prefixo = g.codigo_prefixo
          AND (
            p2.codigo_amigavel = g.codigo_prefixo
            OR (p2.codigo_prefixo IS NULL OR p2.codigo_prefixo = '') 
          )
          AND p2.id != g.id
      )
    ORDER BY g.codigo_prefixo, length(g.codigo_amigavel), g.codigo_amigavel
  ) parent
  WHERE
    v.codigo_prefixo = parent.codigo_prefixo
    AND v.id != parent.id
    AND v.codigo_prefixo IS NOT NULL
    AND v.codigo_prefixo != '';

  -- Step 3: Build variantes JSONB array on each parent
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
