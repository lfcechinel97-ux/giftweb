
-- 1) Rename labels (slug preserved for SEO)
UPDATE public.spotlight_categories SET label = 'Bolsas Térmicas'           WHERE slug = 'bolsas';
UPDATE public.spotlight_categories SET label = 'Blocos de Anotações'       WHERE slug = 'blocos';
UPDATE public.spotlight_categories SET label = 'Fones de Ouvido'           WHERE slug = 'fones';
UPDATE public.spotlight_categories SET label = 'Malas de Viagem'           WHERE slug = 'malas';
UPDATE public.spotlight_categories SET label = 'Marmitas p/ Dia a Dia'     WHERE slug = 'marmitas';
UPDATE public.spotlight_categories SET label = 'Pastas Notebook/Tablet'    WHERE slug = 'pastas';
UPDATE public.spotlight_categories SET label = 'Sacolas Algodão e TNT'     WHERE slug = 'sacolas';

-- 2) Deactivate old categories
UPDATE public.spotlight_categories SET active = false
  WHERE slug IN ('cozinha-e-mesa','copos-e-canecas','garrafas-e-squeezes');

-- 3) Insert new categories (idempotent)
INSERT INTO public.spotlight_categories (slug, label, category_type, active, position) VALUES
  ('copos',                  'Copos',                          'base', true, 11),
  ('canecas',                'Canecas',                        'base', true, 12),
  ('garrafas-termicas',      'Garrafas Térmicas / Squeezes',   'base', true, 16),
  ('garrafas-inox-aluminio', 'Garrafas de Inox / Alumínio',    'base', true, 17),
  ('tabuas-petisqueiras',    'Tábuas e Petisqueiras',          'base', true, 33),
  ('kit-churrasco',          'Kit Churrasco',                  'base', true, 34),
  ('kit-vinho',              'Kit Vinho',                      'base', true, 35),
  ('kit-viagem',             'Kit Viagem',                     'base', true, 36),
  ('kit-manicure',           'Kit Manicure',                   'base', true, 37),
  ('kit-executivo',          'Kit Executivo Escritório',       'base', true, 38)
ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, active = true;

-- 4) Remap products_cache.categoria based on new rules (order = priority)
WITH n AS (
  SELECT id, UPPER(COALESCE(nome,'')) AS up FROM public.products_cache
)
UPDATE public.products_cache pc SET categoria = CASE
  -- Tábuas / petisqueiras / kit queijo
  WHEN n.up LIKE '%TABUA%' OR n.up LIKE '%TÁBUA%' OR n.up LIKE '%PETISQUEIRA%' OR n.up LIKE '%KIT QUEIJO%' THEN 'tabuas-petisqueiras'
  -- Kits específicos
  WHEN n.up LIKE '%KIT CHURRASCO%' OR n.up LIKE '%KIT CARNE%' THEN 'kit-churrasco'
  WHEN n.up LIKE '%KIT VINHO%' OR n.up LIKE '%KIT SOMMELIER%' THEN 'kit-vinho'
  WHEN n.up LIKE '%KIT VIAGEM%' OR n.up LIKE '%KIT DE VIAGEM%' THEN 'kit-viagem'
  WHEN n.up LIKE '%KIT MANICURE%' OR n.up LIKE '%KIT UNHA%' THEN 'kit-manicure'
  WHEN n.up LIKE '%KIT EXECUTIVO%' OR n.up LIKE '%KIT ESCRITORIO%' OR n.up LIKE '%KIT ESCRITÓRIO%' OR n.up LIKE '%KIT OFFICE%' THEN 'kit-executivo'
  -- Papelaria
  WHEN n.up LIKE '%AGENDA%'      THEN 'agendas'
  WHEN n.up LIKE '%CADERNETA%'   THEN 'cadernetas'
  WHEN n.up LIKE '%CADERNO%'     THEN 'cadernos'
  WHEN n.up LIKE '%BLOCO%'       THEN 'blocos'
  WHEN n.up LIKE '%CANETA%' OR n.up LIKE '%LAPISEIRA%' OR n.up LIKE '%MARCA TEXTO%' OR n.up LIKE '%MARCA-TEXTO%' THEN 'canetas'
  -- Bolsas térmicas (ANTES de garrafas para corrigir o bug)
  WHEN n.up LIKE '%BOLSA TERMICA%' OR n.up LIKE '%BOLSA TÉRMICA%' OR n.up LIKE '%LANCHEIRA%' OR n.up LIKE '%COOLER%' OR n.up LIKE '%BAG TERMICA%' OR n.up LIKE '%BAG TÉRMICA%' OR n.up LIKE '%BOLSA ISOTERMICA%' OR n.up LIKE '%BOLSA ISOTÉRMICA%' THEN 'bolsas'
  -- Garrafas térmicas / squeezes térmicos
  WHEN (n.up LIKE '%GARRAFA%' OR n.up LIKE '%SQUEEZE%' OR n.up LIKE '%CHALEIRA%') AND (n.up LIKE '%TERMICA%' OR n.up LIKE '%TÉRMICA%' OR n.up LIKE '%TERMICO%' OR n.up LIKE '%TÉRMICO%') THEN 'garrafas-termicas'
  -- Demais garrafas e squeezes
  WHEN n.up LIKE '%GARRAFA%' OR n.up LIKE '%SQUEEZE%' THEN 'garrafas-inox-aluminio'
  -- Canecas / copos
  WHEN n.up LIKE '%CANECA%' OR n.up LIKE '%MUG%' THEN 'canecas'
  WHEN n.up LIKE '%COPO%' OR n.up LIKE '%TACA%' OR n.up LIKE '%TAÇA%' OR n.up LIKE '%TUMBLER%' THEN 'copos'
  -- Resto
  WHEN n.up LIKE '%MOCHILA%' OR n.up LIKE '%SACOCHILA%' THEN 'mochilas-e-sacochilas'
  WHEN n.up LIKE '%NECESSAIRE%' THEN 'necessaires'
  WHEN n.up LIKE '%SACOLA%' THEN 'sacolas'
  WHEN n.up LIKE '%MALA%' AND n.up NOT LIKE '%MALABAR%' THEN 'malas'
  WHEN n.up LIKE '%PASTA%' THEN 'pastas'
  WHEN n.up LIKE '%ESTOJO%' THEN 'estojos'
  WHEN n.up LIKE '%BOLSA%' THEN 'bolsas'
  WHEN n.up LIKE '%PEN DRIVE%' OR n.up LIKE '%PENDRIVE%' THEN 'pen-drives'
  WHEN n.up LIKE '%POWER BANK%' OR n.up LIKE '%POWERBANK%' OR n.up LIKE '%CARREGADOR PORTATIL%' OR n.up LIKE '%CARREGADOR PORTÁTIL%' THEN 'power-banks'
  WHEN n.up LIKE '%FONE%' OR n.up LIKE '%HEADPHONE%' OR n.up LIKE '%EARPHONE%' OR n.up LIKE '%HEADSET%' THEN 'fones'
  WHEN n.up LIKE '%MOUSE PAD%' OR n.up LIKE '%MOUSEPAD%' THEN 'mouse-pads'
  WHEN n.up LIKE '%SUPORTE%' AND (n.up LIKE '%CELULAR%' OR n.up LIKE '%NOTEBOOK%' OR n.up LIKE '%TABLET%') THEN 'suportes'
  WHEN n.up LIKE '%CHAVEIRO%' THEN 'chaveiros'
  WHEN n.up LIKE '%GUARDA-CHUVA%' OR n.up LIKE '%GUARDA CHUVA%' OR n.up LIKE '%SOMBRINHA%' THEN 'guarda-chuvas'
  WHEN n.up LIKE '%ESPELHO%' THEN 'espelhos'
  WHEN n.up LIKE '%PORTA-RETRATO%' OR n.up LIKE '%PORTA RETRATO%' THEN 'porta-retratos'
  WHEN n.up LIKE '%PORTA-JOIA%' OR n.up LIKE '%PORTA JOIA%' THEN 'porta-joias'
  WHEN n.up LIKE '%PORTA-OBJETO%' OR n.up LIKE '%PORTA OBJETO%' OR n.up LIKE '%ORGANIZADOR%' THEN 'porta-objetos'
  WHEN n.up LIKE '%CAIXA DE SOM%' OR n.up LIKE '%CAIXA SOM%' OR n.up LIKE '%SPEAKER%' THEN 'caixas-de-som'
  WHEN n.up LIKE '%CAIXA ORGANIZADORA%' THEN 'caixas-organizadoras'
  WHEN n.up LIKE '%MARMITA%' OR n.up LIKE '%LUNCH%' THEN 'marmitas'
  WHEN n.up LIKE '%TOALHA%' THEN 'toalhas'
  WHEN n.up LIKE '%KIT%' THEN 'kits'
  ELSE 'outros'
END
FROM n WHERE n.id = pc.id;

-- 5) Rebuild product_spotlight_categories from new categoria column
DELETE FROM public.product_spotlight_categories;
INSERT INTO public.product_spotlight_categories (product_id, category_id, position)
SELECT pc.id, sc.id, 0
FROM public.products_cache pc
JOIN public.spotlight_categories sc
  ON sc.slug = pc.categoria AND sc.category_type = 'base' AND sc.active = true
WHERE pc.ativo = true
ON CONFLICT (product_id, category_id) DO NOTHING;

-- 6) Remove old banners (the "Corporate Gift Items" image)
DELETE FROM public.site_content
WHERE id IN (
  'banner_1_desk','banner_1_mob',
  'banner_2_desk','banner_2_mob',
  'banner_3_desk','banner_3_mob'
);
