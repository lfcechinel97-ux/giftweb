
CREATE TABLE IF NOT EXISTS public.homepage_featured_showcase (
  id          serial PRIMARY KEY,
  position    int NOT NULL DEFAULT 0,
  title       text,
  price_text  text,
  image_url   text,
  link_url    text,
  badge_text  text DEFAULT 'Mais Vendido',
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE public.homepage_featured_showcase ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public_read_showcase" ON public.homepage_featured_showcase FOR SELECT USING (true);

CREATE POLICY "admin_write_showcase" ON public.homepage_featured_showcase FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

INSERT INTO public.homepage_featured_showcase (position, is_active)
VALUES (1,false),(2,false),(3,false),(4,false),
       (5,false),(6,false),(7,false),(8,false);
