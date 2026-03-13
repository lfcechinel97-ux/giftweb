
CREATE OR REPLACE FUNCTION public.update_sort_estoque()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.sort_estoque := CASE WHEN COALESCE(NEW.estoque, 0) > 0 THEN 0 ELSE 1 END;
  RETURN NEW;
END;
$$;
