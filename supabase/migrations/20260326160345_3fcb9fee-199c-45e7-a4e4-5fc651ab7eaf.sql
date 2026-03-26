
CREATE OR REPLACE FUNCTION public.calc_display_price(p_preco_custo numeric)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT p_preco_custo * (
    CASE
      WHEN p_preco_custo <= 1 THEN 6.0
      WHEN p_preco_custo <= 3 THEN 4.8
      WHEN p_preco_custo <= 8 THEN 3.8
      WHEN p_preco_custo <= 15 THEN 3.0
      WHEN p_preco_custo <= 25 THEN 2.5
      WHEN p_preco_custo <= 40 THEN 2.1
      WHEN p_preco_custo <= 70 THEN 1.8
      ELSE 1.6
    END
  ) * (1 - 0.16);
$$;
