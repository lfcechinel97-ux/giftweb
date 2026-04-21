CREATE OR REPLACE FUNCTION public.get_category_cost_distribution(p_category_id uuid)
 RETURNS TABLE(bucket text, min_val numeric, max_val numeric, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH bands(bucket, min_val, max_val, ord) AS (
    VALUES
      ('0,01–0,50'::text,    0.01::numeric,   0.50::numeric, 1),
      ('0,51–1,00'::text,    0.51::numeric,   1.00::numeric, 2),
      ('1,01–2,00'::text,    1.01::numeric,   2.00::numeric, 3),
      ('2,01–5,00'::text,    2.01::numeric,   5.00::numeric, 4),
      ('5,01–10,00'::text,   5.01::numeric,  10.00::numeric, 5),
      ('10,01–15,00'::text, 10.01::numeric,  15.00::numeric, 6),
      ('15,01–20,00'::text, 15.01::numeric,  20.00::numeric, 7),
      ('20,01–25,00'::text, 20.01::numeric,  25.00::numeric, 8),
      ('25,01–30,00'::text, 25.01::numeric,  30.00::numeric, 9),
      ('30,01–35,00'::text, 30.01::numeric,  35.00::numeric, 10),
      ('35,01–40,00'::text, 35.01::numeric,  40.00::numeric, 11),
      ('40,01–45,00'::text, 40.01::numeric,  45.00::numeric, 12),
      ('45,01–50,00'::text, 45.01::numeric,  50.00::numeric, 13),
      ('50,01–60,00'::text, 50.01::numeric,  60.00::numeric, 14),
      ('60,01–70,00'::text, 60.01::numeric,  70.00::numeric, 15),
      ('70,01–100,00'::text, 70.01::numeric, 100.00::numeric, 16),
      ('100,01+'::text,    100.01::numeric, 999999::numeric, 17)
  )
  SELECT b.bucket, b.min_val, b.max_val,
    COALESCE(COUNT(DISTINCT pc.id), 0)::bigint AS total
  FROM bands b
  LEFT JOIN product_spotlight_categories psc ON psc.category_id = p_category_id
  LEFT JOIN products_cache pc
    ON pc.id = psc.product_id
   AND pc.ativo = true
   AND COALESCE(pc.preco_custo, 0) >= b.min_val
   AND COALESCE(pc.preco_custo, 0) <= b.max_val
  GROUP BY b.bucket, b.min_val, b.max_val, b.ord
  ORDER BY b.ord;
$function$;