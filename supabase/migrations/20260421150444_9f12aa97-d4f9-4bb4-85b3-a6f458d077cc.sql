
CREATE OR REPLACE FUNCTION public.get_category_product_counts()
RETURNS TABLE(category_id uuid, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT psc.category_id, count(DISTINCT psc.product_id)::bigint AS total
  FROM product_spotlight_categories psc
  JOIN products_cache pc ON pc.id = psc.product_id
  WHERE pc.ativo = true
  GROUP BY psc.category_id;
$$;

CREATE OR REPLACE FUNCTION public.get_category_cost_distribution(p_category_id uuid)
RETURNS TABLE(bucket text, min_val numeric, max_val numeric, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bands(bucket, min_val, max_val) AS (
    VALUES
      ('0,01–0,50'::text,    0.01::numeric, 0.50::numeric),
      ('0,51–1,00'::text,    0.51::numeric, 1.00::numeric),
      ('1,01–2,00'::text,    1.01::numeric, 2.00::numeric),
      ('2,01–5,00'::text,    2.01::numeric, 5.00::numeric),
      ('5,01–10,00'::text,   5.01::numeric, 10.00::numeric),
      ('10,01–20,00'::text, 10.01::numeric, 20.00::numeric),
      ('20,01–30,00'::text, 20.01::numeric, 30.00::numeric),
      ('30,01–50,00'::text, 30.01::numeric, 50.00::numeric),
      ('50,01–70,00'::text, 50.01::numeric, 70.00::numeric),
      ('70,01+'::text,      70.01::numeric, 999999::numeric)
  )
  SELECT b.bucket, b.min_val, b.max_val,
    count(DISTINCT pc.id)::bigint AS total
  FROM bands b
  LEFT JOIN product_spotlight_categories psc ON psc.category_id = p_category_id
  LEFT JOIN products_cache pc
    ON pc.id = psc.product_id
   AND pc.ativo = true
   AND COALESCE(pc.preco_custo, 0) >= b.min_val
   AND COALESCE(pc.preco_custo, 0) <= b.max_val
  GROUP BY b.bucket, b.min_val, b.max_val
  HAVING count(DISTINCT pc.id) > 0
  ORDER BY b.min_val;
$$;
