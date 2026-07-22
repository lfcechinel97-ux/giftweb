
CREATE TABLE public.topprodutos_curadoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao_curta TEXT,
  descricao_longa TEXT,
  preco_exibicao NUMERIC(10,2),
  categoria TEXT NOT NULL,
  moq INTEGER NOT NULL DEFAULT 20,
  mais_vendido BOOLEAN NOT NULL DEFAULT false,
  ordem INTEGER NOT NULL DEFAULT 0,
  imagem_principal TEXT,
  imagem_hover TEXT,
  galeria JSONB NOT NULL DEFAULT '[]'::jsonb,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.topprodutos_curadoria TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.topprodutos_curadoria TO authenticated;
GRANT ALL ON public.topprodutos_curadoria TO service_role;

ALTER TABLE public.topprodutos_curadoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active curated products"
  ON public.topprodutos_curadoria FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert curated products"
  ON public.topprodutos_curadoria FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins can update curated products"
  ON public.topprodutos_curadoria FOR UPDATE
  TO authenticated
  USING (public.is_admin_user())
  WITH CHECK (public.is_admin_user());

CREATE POLICY "Admins can delete curated products"
  ON public.topprodutos_curadoria FOR DELETE
  TO authenticated
  USING (public.is_admin_user());

CREATE OR REPLACE FUNCTION public.topprodutos_curadoria_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_topprodutos_curadoria_updated_at
  BEFORE UPDATE ON public.topprodutos_curadoria
  FOR EACH ROW EXECUTE FUNCTION public.topprodutos_curadoria_set_updated_at();

CREATE INDEX idx_topprodutos_categoria ON public.topprodutos_curadoria(categoria, ordem);
CREATE INDEX idx_topprodutos_mais_vendido ON public.topprodutos_curadoria(mais_vendido, ordem) WHERE mais_vendido = true;

-- Seed 48 placeholders: 6 per category
DO $seed$
DECLARE
  cats TEXT[][] := ARRAY[
    ['garrafas-agua','Garrafas de Água'],
    ['copos-cafe-cerveja','Copos Café/Cerveja'],
    ['guarda-chuvas','Guarda-Chuvas'],
    ['kit-churrasco-vinho','Kit Churrasco/Vinho'],
    ['som-power-bank','Som e Power Bank'],
    ['sacola-tnt-algodao','Sacola TNT e Algodão'],
    ['caderneta-caneta','Caderneta + Caneta'],
    ['mochilas-bolsa-necessaire','Mochilas/Bolsa Térmica e Necessaire']
  ];
  i INT;
  j INT;
BEGIN
  FOR i IN 1..array_length(cats,1) LOOP
    FOR j IN 1..6 LOOP
      INSERT INTO public.topprodutos_curadoria (nome, categoria, ordem, moq, mais_vendido, imagem_principal)
      VALUES (
        'Produto ' || j || ' — ' || cats[i][2],
        cats[i][1],
        j,
        20,
        false,
        '/placeholder-product.webp'
      );
    END LOOP;
  END LOOP;
END
$seed$;
