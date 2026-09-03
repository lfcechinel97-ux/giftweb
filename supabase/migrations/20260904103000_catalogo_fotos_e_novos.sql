-- Fotos e produtos novos do catalogo de clientes.
--
-- 1) Segunda foto: ate aqui vinha do products_cache, que so guarda uma
--    imagem por cor - o que aparecia no hover era o MESMO produto em outra
--    cor. A foto coletiva (todas as cores juntas) so existe na galeria da
--    pagina do produto no site do fornecedor. Ver scripts/xbz_feed/
--    galeria_site.py.
-- 2) Produtos novos pedidos, com as duas fotos e preco = custo x 2,5 / 2,2 / 2,0,
--    a mesma conta da carga inicial das faixas.
--
-- Gerado por scripts/xbz_feed/sql_catalogo.py - nao editar a mao.

-- ── 1. segunda foto (coletiva) ──
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/14794-2-ec9fa087.jpg' WHERE codigo = '14794';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/06033-2-c6118449.jpg' WHERE codigo = '06033';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18921-2-f75685e7.jpg' WHERE codigo = '18921';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18645L-2-48854a70.jpg' WHERE codigo = '18645L';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/03006A-2-158ef010.jpg' WHERE codigo = '03006A';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/14726L-2-7245bf83.jpg' WHERE codigo = '14726L';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/06096-2-c019cf01.jpg' WHERE codigo = '06096';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/12487F-2-f624bcb8.jpg' WHERE codigo = '12487F';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/02112-2-106fe212.jpg' WHERE codigo = '02112';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18695-2-208d7781.jpg' WHERE codigo = '18695';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/09138-2-bb92e3ef.jpg' WHERE codigo = '09138';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18552-2-bdc42fc9.jpg' WHERE codigo = '18552';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/17011F-2-4651efad.jpg' WHERE codigo = '17011F';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18855-2-0ef330c4.jpg' WHERE codigo = '18855';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/08195-2-b72f6c8a.jpg' WHERE codigo = '08195';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/07392-2-c140c363.jpg' WHERE codigo = '07392';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/04070-2-af23e60e.jpg' WHERE codigo = '04070';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18912-2-99890aeb.jpg' WHERE codigo = '18912';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/01320-2-8184f2ea.jpg' WHERE codigo = '01320';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18539-2-0aa2268a.jpg' WHERE codigo = '18539';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/02105-2-d1134bb9.jpg' WHERE codigo = '02105';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/02066-2-80c58695.jpg' WHERE codigo = '02066';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18601-2-ef1bcdf3.jpg' WHERE codigo = '18601';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/01326-2-4140ac3b.jpg' WHERE codigo = '01326';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/02596-2-63ce31f7.jpg' WHERE codigo = '02596';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/02697-2-a1e237d5.jpg' WHERE codigo = '02697';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/06070P-2-4d4ba6d8.jpg' WHERE codigo = '06070P';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/08242-2-7c5bae50.jpg' WHERE codigo = '08242';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18516-2-fa7288f2.jpg' WHERE codigo = '18516';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18501-2-ac9724c8.jpg' WHERE codigo = '18501';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/01228P-2-471a6b11.jpg' WHERE codigo = '01228P';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18753-2-ed3ef893.jpg' WHERE codigo = '18753';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/01622B-2-eaf16459.jpg' WHERE codigo = '01622B';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/08142-2-94d884d3.jpg' WHERE codigo = '08142';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18717-2-9b41b74b.jpg' WHERE codigo = '18717';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18724-2-be3fca62.jpg' WHERE codigo = '18724';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18900-2-15d99c5b.jpg' WHERE codigo = '18900';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/03009-2-0a74bba5.jpg' WHERE codigo = '03009';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/05067-2-e3cf9150.jpg' WHERE codigo = '05067';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/14092N-2-a06ff290.jpg' WHERE codigo = '14092N';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/05071-2-00429a17.jpg' WHERE codigo = '05071';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/06098-2-51238158.jpg' WHERE codigo = '06098';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/12638-2-4f1be0ab.jpg' WHERE codigo = '12638';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/ER143B-2-7c5a91e1.jpg' WHERE codigo = 'ER143B';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/13499B-2-5e2a897d.jpg' WHERE codigo = '13499B';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/05015B-2-70781d19.jpg' WHERE codigo = '05015B';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/09824-2-19978f81.jpg' WHERE codigo = '09824';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/01955-2-a1bdcfd4.jpg' WHERE codigo = '01955';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/08232-2-4feabf2c.jpg' WHERE codigo = '08232';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/01812-2-68eb2639.jpg' WHERE codigo = '01812';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/01810-2-cc34c267.jpg' WHERE codigo = '01810';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/07048B-2-2154a2f2.jpg' WHERE codigo = '07048B';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/08254-2-f5b0ba1b.jpg' WHERE codigo = '08254';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/19029-2-d921f54e.jpg' WHERE codigo = '19029';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/04362-2-2aea14dd.jpg' WHERE codigo = '04362';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/08002-2-d3fbece9.jpg' WHERE codigo = '08002';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/12789-2-82c5b9a2.jpg' WHERE codigo = '12789';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/06064-2-3af0d899.jpg' WHERE codigo = '06064';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/05048-2-15e22119.jpg' WHERE codigo = '05048';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/09145-2-dd383dac.jpg' WHERE codigo = '09145';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/08188-2-6f64672b.jpg' WHERE codigo = '08188';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18537G-2-28042448.jpg' WHERE codigo = '18537G';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/13780-2-b06a26fb.jpg' WHERE codigo = '13780';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18537P-2-30b0dadf.jpg' WHERE codigo = '18537P';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/13781N-2-02882425.jpg' WHERE codigo = '13781N';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/04399-2-5b6874e9.jpg' WHERE codigo = '04399';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/07447-2-3d96901e.jpg' WHERE codigo = '07447';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/01644-2-260b9739.jpg' WHERE codigo = '01644';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18891-2-689026bb.jpg' WHERE codigo = '18891';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18621-2-57212c2c.jpg' WHERE codigo = '18621';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/10071G-2-fbc82106.jpg' WHERE codigo = '10071G';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/03493-2-3456d346.jpg' WHERE codigo = '03493';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/11870-2-3b7087f9.jpg' WHERE codigo = '11870';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/10695-2-824aea01.jpg' WHERE codigo = '10695';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18857-2-72806b29.jpg' WHERE codigo = '18857';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18858-2-093d15d1.jpg' WHERE codigo = '18858';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18629-2-6fb19579.jpg' WHERE codigo = '18629';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/02075-2-284072c6.jpg' WHERE codigo = '02075';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/05198-2-19797d77.jpg' WHERE codigo = '05198';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/02078-2-ddcb2454.jpg' WHERE codigo = '02078';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/05045-2-11ca6443.jpg' WHERE codigo = '05045';
UPDATE public.catalogo_clientes SET imagem_secundaria_url = 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/06063-2-62ece544.jpg' WHERE codigo = '06063';

-- ── 2. produtos novos ──
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('18962', 'Mochila Térmica 18L', 'MOCHILAS, BOLSAS TÉRMICAS E MALAS',
  'Mochilas, Bolsas e Malas', 'bolsas-termicas', 'Bolsas Térmicas',
  84.50, 20, 84.50, 50, 74.36, 100, 67.60,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18962-1-799459f5.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18962-2-e6c75a66.jpg',
  '[{"n": "Azul", "h": "#3B82F6"}, {"n": "Cinza", "h": "#6B7280"}, {"n": "Preto", "h": "#111827"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('18967', 'Bolsa Térmica 5L', 'MOCHILAS, BOLSAS TÉRMICAS E MALAS',
  'Mochilas, Bolsas e Malas', 'bolsas-termicas', 'Bolsas Térmicas',
  17.25, 20, 17.25, 50, 15.18, 100, 13.80,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18967-1-b83b9526.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18967-2-5d7abbe8.jpg',
  '[{"n": "Preto", "h": "#111827"}, {"n": "Rosa", "h": "#EC4899"}, {"n": "Vermelho", "h": "#EF4444"}, {"n": "Cinza", "h": "#6B7280"}, {"n": "Azul", "h": "#3B82F6"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('04846', 'Bolsa Térmica 7L', 'MOCHILAS, BOLSAS TÉRMICAS E MALAS',
  'Mochilas, Bolsas e Malas', 'bolsas-termicas', 'Bolsas Térmicas',
  58.75, 20, 58.75, 50, 51.70, 100, 47.00,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/04846-1-71240a90.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/04846-2-10be806f.jpg',
  '[{"n": "Preto", "h": "#111827"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('09150', 'Bolsa Térmica 33 Litros', 'MOCHILAS, BOLSAS TÉRMICAS E MALAS',
  'Mochilas, Bolsas e Malas', 'bolsas-termicas', 'Bolsas Térmicas',
  219.75, 20, 219.75, 50, 193.38, 100, 175.80,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/09150-1-ea11ff96.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/09150-2-38d73121.jpg',
  '[{"n": "Preto", "h": "#111827"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('18961', 'Bolsa Térmica 20 Litros', 'MOCHILAS, BOLSAS TÉRMICAS E MALAS',
  'Mochilas, Bolsas e Malas', 'bolsas-termicas', 'Bolsas Térmicas',
  81.25, 20, 81.25, 50, 71.50, 100, 65.00,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18961-1-6d7aebac.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18961-2-70184913.jpg',
  '[{"n": "Azul", "h": "#3B82F6"}, {"n": "Preto", "h": "#111827"}, {"n": "Cinza", "h": "#6B7280"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('04098', 'Garrafa Térmica 700Ml', 'COPOS, GARRAFAS E CANECAS',
  'Copos, Garrafas e Canecas', 'garrafas', 'Garrafas',
  79.75, 20, 79.75, 50, 70.18, 100, 63.80,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/04098-1-e0ddad57.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/04098-2-d6fd8682.jpg',
  '[{"n": "Preto", "h": "#111827"}, {"n": "Rosa", "h": "#EC4899"}, {"n": "Verde", "h": "#22C55E"}, {"n": "Amarelo", "h": "#EAB308"}, {"n": "Laranja", "h": "#F97316"}, {"n": "Branco", "h": "#F9FAFB"}, {"n": "Azul", "h": "#3B82F6"}, {"n": "Chumbo", "h": "#4B5563"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('04014', 'Copo Térmico', 'COPOS, GARRAFAS E CANECAS',
  'Copos, Garrafas e Canecas', 'copos-e-canecas', 'Copos e Canecas',
  61.25, 20, 61.25, 50, 53.90, 100, 49.00,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/04014-1-3eb13d70.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/04014-2-bace65fd.jpg',
  '[{"n": "Branco", "h": "#F9FAFB"}, {"n": "Laranja", "h": "#F97316"}, {"n": "Azul", "h": "#3B82F6"}, {"n": "Dourado", "h": "#D4A15A"}, {"n": "Vermelho", "h": "#EF4444"}, {"n": "Preto", "h": "#111827"}, {"n": "Rosa", "h": "#EC4899"}, {"n": "Verde", "h": "#22C55E"}, {"n": "Amarelo", "h": "#EAB308"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('14724', 'Copo Térmico 500Ml P/ Café', 'COPOS, GARRAFAS E CANECAS',
  'Copos, Garrafas e Canecas', 'copos-e-canecas', 'Copos e Canecas',
  61.25, 20, 61.25, 50, 53.90, 100, 49.00,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/14724-1-e10cfc9a.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/14724-2-672d4ec8.jpg',
  '[{"n": "Azul", "h": "#3B82F6"}, {"n": "Vermelho", "h": "#EF4444"}, {"n": "Bege", "h": "#E8D9BE"}, {"n": "Marrom", "h": "#92400E"}, {"n": "Rosa", "h": "#EC4899"}, {"n": "Preto", "h": "#111827"}, {"n": "Branco", "h": "#F9FAFB"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('04081', 'Caneca Termica 350Ml', 'COPOS, GARRAFAS E CANECAS',
  'Copos, Garrafas e Canecas', 'copos-e-canecas', 'Copos e Canecas',
  61.25, 20, 61.25, 50, 53.90, 100, 49.00,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/04081-1-74ef2ae1.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/04081-2-cb2a9f4b.jpg',
  '[{"n": "Azul", "h": "#3B82F6"}, {"n": "Verde", "h": "#22C55E"}, {"n": "Vermelho", "h": "#EF4444"}, {"n": "Preto", "h": "#111827"}, {"n": "Branco", "h": "#F9FAFB"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('18587', 'Tábua De Corte', 'MARMITAS E TÁBUAS DE MADEIRA',
  'Marmitas e Tábuas', 'tabuas', 'Tábuas',
  27.50, 20, 27.50, 50, 24.20, 100, 22.00,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18587-1-ec039013.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18587-2-9c61de50.jpg',
  '[{"n": "Madeira", "h": "#B98B57"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('18608', 'Tábua P/ Corte C/ Canaleta 30*40Cm', 'MARMITAS E TÁBUAS DE MADEIRA',
  'Marmitas e Tábuas', 'tabuas', 'Tábuas',
  52.50, 20, 52.50, 50, 46.20, 100, 42.00,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18608-1-f6fdd58a.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18608-2-d6f178de.jpg',
  '[{"n": "Madeira", "h": "#B98B57"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;
INSERT INTO public.catalogo_clientes
  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,
   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,
   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)
VALUES ('18507', 'Necessaire Organizadora', 'NECESSAIRES, PORTA JOIAS E KIT MANICURE',
  'Necessaires e Porta Joias', 'necessaires-e-porta-joias', 'Necessaires e Porta Joias',
  47.25, 20, 47.25, 50, 41.58, 100, 37.80,
  'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18507-1-10d8df48.jpg', 'https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/catalogo-meta/18507-2-f436389d.jpg',
  '[{"n": "Rosa", "h": "#EC4899"}, {"n": "Cinza", "h": "#6B7280"}, {"n": "Preto", "h": "#111827"}, {"n": "Azul", "h": "#3B82F6"}, {"n": "Laranja", "h": "#F97316"}]'::jsonb, false, true,
  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))
ON CONFLICT (codigo) DO UPDATE SET
  imagem_url = EXCLUDED.imagem_url,
  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,
  cores = EXCLUDED.cores,
  ativo = true;

-- ── 3. faixa 100 / 200 / 1000 tambem nos produtos novos que caem em
--    caneta, sacola ou no chaveiro 09824 (nenhum hoje, mas a regra fica
--    valendo caso um deles entre nesses grupos depois) ──
UPDATE public.catalogo_clientes
SET faixa1_qtd = 100, faixa2_qtd = 200, faixa3_qtd = 1000
WHERE (grupo IN ('canetas', 'sacolas') OR codigo = '09824')
  AND faixa1_qtd IS DISTINCT FROM 100;
