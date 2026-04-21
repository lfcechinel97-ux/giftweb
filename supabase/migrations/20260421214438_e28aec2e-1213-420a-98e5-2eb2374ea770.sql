-- Move thermal bags from "Garrafas e Squeezes" to "Bolsas"

-- Step 1: Ensure link to "Bolsas" category
INSERT INTO product_spotlight_categories (product_id, category_id)
SELECT DISTINCT pc.id, 'e8665733-49a6-4465-8f65-1f4122a5bfa0'::uuid
FROM products_cache pc
WHERE (pc.nome ILIKE '%bolsa térmica%' OR pc.nome ILIKE '%bolsa termica%'
       OR pc.nome ILIKE '%lancheira%' OR pc.nome ILIKE '%cooler bag%'
       OR pc.nome ILIKE '%bag térmica%' OR pc.nome ILIKE '%bag termica%')
  AND NOT EXISTS (
    SELECT 1 FROM product_spotlight_categories psc2
    WHERE psc2.product_id = pc.id
      AND psc2.category_id = 'e8665733-49a6-4465-8f65-1f4122a5bfa0'::uuid
  );

-- Step 2: Remove incorrect link from "Garrafas e Squeezes"
DELETE FROM product_spotlight_categories psc
USING products_cache pc
WHERE psc.product_id = pc.id
  AND psc.category_id = '59e0b987-ee37-45da-869c-9ab62f16e607'::uuid
  AND (pc.nome ILIKE '%bolsa térmica%' OR pc.nome ILIKE '%bolsa termica%'
       OR pc.nome ILIKE '%lancheira%' OR pc.nome ILIKE '%cooler bag%'
       OR pc.nome ILIKE '%bag térmica%' OR pc.nome ILIKE '%bag termica%');