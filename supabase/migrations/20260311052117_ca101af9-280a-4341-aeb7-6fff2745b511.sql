
-- Table: products_cache
CREATE TABLE public.products_cache (
  id               uuid primary key default gen_random_uuid(),
  codigo_amigavel  text not null unique,
  slug             text,
  nome             text not null,
  descricao        text,
  image_url        text,
  site_link        text,
  cor              text,
  categoria        text default 'outros',
  marca            text default 'XBZ',
  preco_custo      numeric(10,2) default 0,
  estoque          integer default 0,
  peso             numeric(10,3),
  altura           numeric(10,2),
  largura          numeric(10,2),
  profundidade     numeric(10,2),
  ativo            boolean default true,
  busca            text,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  ultima_sync      timestamptz
);

-- Indexes
CREATE INDEX idx_categoria ON public.products_cache(categoria);
CREATE INDEX idx_slug ON public.products_cache(slug);
CREATE INDEX idx_cor ON public.products_cache(cor);
CREATE INDEX idx_ativo ON public.products_cache(ativo);
CREATE INDEX idx_marca ON public.products_cache(marca);
CREATE INDEX idx_busca ON public.products_cache USING gin(to_tsvector('simple', busca));

-- RLS for products_cache
ALTER TABLE public.products_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access" ON public.products_cache
  FOR SELECT TO anon, authenticated USING (true);

-- Table: sync_log
CREATE TABLE public.sync_log (
  id              uuid primary key default gen_random_uuid(),
  synced_at       timestamptz default now(),
  total_products  integer default 0,
  status          text,
  erro            text
);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sync_log" ON public.sync_log
  FOR SELECT TO authenticated USING (true);

-- Table: leads
CREATE TABLE public.leads (
  id          uuid primary key default gen_random_uuid(),
  nome        text,
  email       text not null,
  empresa     text,
  created_at  timestamptz default now()
);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon can insert leads" ON public.leads
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated can read leads" ON public.leads
  FOR SELECT TO authenticated USING (true);
