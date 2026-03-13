
-- Add sorting columns
ALTER TABLE public.products_cache ADD COLUMN IF NOT EXISTS variantes_count integer DEFAULT 1;
ALTER TABLE public.products_cache ADD COLUMN IF NOT EXISTS sort_estoque smallint DEFAULT 0;

-- Populate variantes_count from existing variantes JSONB
UPDATE public.products_cache 
SET variantes_count = COALESCE(jsonb_array_length(variantes), 0) + 1
WHERE is_variante = false AND variantes IS NOT NULL;

-- Populate sort_estoque
UPDATE public.products_cache 
SET sort_estoque = CASE WHEN COALESCE(estoque, 0) > 0 THEN 0 ELSE 1 END;

-- Trigger to auto-update sort_estoque on insert/update
CREATE OR REPLACE FUNCTION public.update_sort_estoque()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.sort_estoque := CASE WHEN COALESCE(NEW.estoque, 0) > 0 THEN 0 ELSE 1 END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_sort_estoque
BEFORE INSERT OR UPDATE OF estoque ON public.products_cache
FOR EACH ROW EXECUTE FUNCTION public.update_sort_estoque();

-- Update set_variantes_por_prefixo to also set variantes_count
CREATE OR REPLACE FUNCTION public.set_variantes_por_prefixo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  -- Reset all
  UPDATE products_cache SET produto_pai = NULL, is_variante = false, variantes = NULL, variantes_count = 1;

  -- Pick the parent: the row with the shortest codigo_amigavel per prefix group
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
  SET variantes = sub.variantes_json,
      variantes_count = sub.cnt + 1
  FROM (
    SELECT 
      produto_pai,
      count(*) as cnt,
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

-- Create index for the new sort columns
CREATE INDEX IF NOT EXISTS idx_sort_estoque_variantes ON public.products_cache (sort_estoque, variantes_count DESC, estoque DESC NULLS LAST);
