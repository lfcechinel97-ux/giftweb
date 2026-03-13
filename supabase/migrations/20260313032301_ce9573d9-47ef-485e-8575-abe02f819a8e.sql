
-- Add variantes jsonb column to products_cache
ALTER TABLE public.products_cache ADD COLUMN IF NOT EXISTS variantes jsonb DEFAULT NULL;

-- Update RPC to also populate variantes jsonb on parent products
CREATE OR REPLACE FUNCTION public.set_variantes_por_prefixo()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
BEGIN
  -- Reset variantes and is_variante
  UPDATE products_cache SET produto_pai = NULL, is_variante = false WHERE is_variante = true;
  UPDATE products_cache SET variantes = NULL WHERE variantes IS NOT NULL;

  -- Set produto_pai on variants
  UPDATE products_cache v
  SET 
    produto_pai = p.id,
    is_variante = true
  FROM products_cache p
  WHERE
    v.codigo_prefixo = p.codigo_prefixo
    AND v.codigo_amigavel <> p.codigo_amigavel
    AND p.is_variante = false;

  -- Populate variantes jsonb on parent products
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
