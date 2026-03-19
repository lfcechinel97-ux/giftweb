
-- Tabela de categorias (base + marketing)
CREATE TABLE public.spotlight_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  category_type text NOT NULL DEFAULT 'marketing',
  created_at timestamptz DEFAULT now()
);

-- Tabela de junção produto <-> categoria
CREATE TABLE public.product_spotlight_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products_cache(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.spotlight_categories(id) ON DELETE CASCADE,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(product_id, category_id)
);

-- RLS spotlight_categories
ALTER TABLE public.spotlight_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_spotlight" ON public.spotlight_categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admin_write_spotlight" ON public.spotlight_categories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));

-- RLS product_spotlight_categories
ALTER TABLE public.product_spotlight_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_psc" ON public.product_spotlight_categories
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "admin_write_psc" ON public.product_spotlight_categories
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));

-- Índices
CREATE INDEX idx_psc_product ON public.product_spotlight_categories(product_id);
CREATE INDEX idx_psc_category ON public.product_spotlight_categories(category_id);
CREATE INDEX idx_spotlight_type ON public.spotlight_categories(category_type);
