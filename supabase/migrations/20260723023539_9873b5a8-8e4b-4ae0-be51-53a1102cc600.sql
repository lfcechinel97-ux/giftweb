
ALTER TABLE public.topprodutos_curadoria
  ADD COLUMN IF NOT EXISTS destaque text NOT NULL DEFAULT 'padrao',
  ADD COLUMN IF NOT EXISTS imagem_editorial text;

ALTER TABLE public.topprodutos_curadoria
  DROP CONSTRAINT IF EXISTS topprodutos_curadoria_destaque_check;
ALTER TABLE public.topprodutos_curadoria
  ADD CONSTRAINT topprodutos_curadoria_destaque_check
  CHECK (destaque IN ('padrao','medio','grande'));

CREATE TABLE IF NOT EXISTS public.topprodutos_categorias_meta (
  slug text PRIMARY KEY,
  imagem_capa text,
  eyebrow text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.topprodutos_categorias_meta TO anon, authenticated;
GRANT ALL ON public.topprodutos_categorias_meta TO service_role;

ALTER TABLE public.topprodutos_categorias_meta ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read categorias meta" ON public.topprodutos_categorias_meta;
CREATE POLICY "Public read categorias meta" ON public.topprodutos_categorias_meta
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage categorias meta" ON public.topprodutos_categorias_meta;
CREATE POLICY "Admins manage categorias meta" ON public.topprodutos_categorias_meta
  FOR ALL USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

DROP TRIGGER IF EXISTS trg_topprodutos_categorias_meta_updated ON public.topprodutos_categorias_meta;
CREATE TRIGGER trg_topprodutos_categorias_meta_updated
  BEFORE UPDATE ON public.topprodutos_categorias_meta
  FOR EACH ROW EXECUTE FUNCTION public.topprodutos_curadoria_set_updated_at();
