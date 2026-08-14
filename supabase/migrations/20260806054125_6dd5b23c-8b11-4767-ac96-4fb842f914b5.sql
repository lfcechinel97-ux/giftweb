-- A) Numeração de pedido: inteiro sequencial simples
ALTER SEQUENCE public.sistema_pedido_seq RESTART WITH 100621;

CREATE OR REPLACE FUNCTION public.sistema_next_pedido_numero()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT nextval('public.sistema_pedido_seq')::text;
$function$;

-- B) Datas de produção e despacho
ALTER TABLE public.sistema_pedidos
  ADD COLUMN IF NOT EXISTS prazo_producao_dias integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS data_produzir_ate date,
  ADD COLUMN IF NOT EXISTS data_despachar_ate date;

ALTER TABLE public.sistema_orcamentos
  ADD COLUMN IF NOT EXISTS prazo_producao_dias integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS data_produzir_ate date,
  ADD COLUMN IF NOT EXISTS data_despachar_ate date;

CREATE OR REPLACE FUNCTION public.sistema_calc_datas_producao()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_base date;
  v_old_despachar date;
  v_old_produzir date;
BEGIN
  v_base := COALESCE(NEW.created_at, now())::date;

  IF TG_OP = 'INSERT' THEN
    IF NEW.data_despachar_ate IS NULL THEN
      NEW.data_despachar_ate := v_base + COALESCE(NEW.prazo_producao_dias, 15);
    END IF;
    IF NEW.data_produzir_ate IS NULL THEN
      NEW.data_produzir_ate := NEW.data_despachar_ate - 2;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE: recalcula apenas se o prazo mudou e as datas ainda são as calculadas
  IF NEW.prazo_producao_dias IS DISTINCT FROM OLD.prazo_producao_dias THEN
    v_old_despachar := v_base + COALESCE(OLD.prazo_producao_dias, 15);
    v_old_produzir := v_old_despachar - 2;

    IF NEW.data_despachar_ate IS NOT DISTINCT FROM OLD.data_despachar_ate
       AND (OLD.data_despachar_ate IS NULL OR OLD.data_despachar_ate = v_old_despachar) THEN
      NEW.data_despachar_ate := v_base + COALESCE(NEW.prazo_producao_dias, 15);
      IF NEW.data_produzir_ate IS NOT DISTINCT FROM OLD.data_produzir_ate
         AND (OLD.data_produzir_ate IS NULL OR OLD.data_produzir_ate = v_old_produzir) THEN
        NEW.data_produzir_ate := NEW.data_despachar_ate - 2;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_datas_producao_pedidos ON public.sistema_pedidos;
CREATE TRIGGER trg_datas_producao_pedidos
BEFORE INSERT OR UPDATE ON public.sistema_pedidos
FOR EACH ROW EXECUTE FUNCTION public.sistema_calc_datas_producao();

DROP TRIGGER IF EXISTS trg_datas_producao_orcamentos ON public.sistema_orcamentos;
CREATE TRIGGER trg_datas_producao_orcamentos
BEFORE INSERT OR UPDATE ON public.sistema_orcamentos
FOR EACH ROW EXECUTE FUNCTION public.sistema_calc_datas_producao();

-- Preenche registros existentes
UPDATE public.sistema_pedidos
SET data_despachar_ate = COALESCE(data_despachar_ate, created_at::date + 15),
    data_produzir_ate = COALESCE(data_produzir_ate, created_at::date + 13);

UPDATE public.sistema_orcamentos
SET data_despachar_ate = COALESCE(data_despachar_ate, created_at::date + 15),
    data_produzir_ate = COALESCE(data_produzir_ate, created_at::date + 13);

-- Renumera os pedidos existentes preservando a ordem de criação
WITH ordenados AS (
  SELECT id, 100617 + row_number() OVER (ORDER BY created_at) AS novo
  FROM public.sistema_pedidos
  WHERE numero LIKE 'PED-%'
)
UPDATE public.sistema_pedidos p
SET numero = o.novo::text
FROM ordenados o
WHERE p.id = o.id;