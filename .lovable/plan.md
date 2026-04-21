

## Mover bolsas térmicas para a categoria "Bolsas"

### Diagnóstico
- 1.208 produtos com "térmica/termica" no nome estão vinculados à categoria **Garrafas e Squeezes** (`garrafas-e-squeezes`, id `59e0b987…`).
- Devem estar em **Bolsas** (`bolsas`, id `e8665733…`). Alguns já estão lá em paralelo.
- Vinculação dupla acontece porque `product_spotlight_categories` permite múltiplas categorias por produto.

### Solução (2 passos via migration de dados)

**1. Garantir vínculo em "Bolsas"** para todo produto que tem "bolsa térmica/termica" no nome:
```sql
INSERT INTO product_spotlight_categories (product_id, category_id)
SELECT DISTINCT pc.id, 'e8665733-49a6-4465-8f65-1f4122a5bfa0'::uuid
FROM products_cache pc
WHERE (pc.nome ILIKE '%bolsa térmica%' OR pc.nome ILIKE '%bolsa termica%'
       OR pc.nome ILIKE '%lancheira%' OR pc.nome ILIKE '%cooler bag%'
       OR pc.nome ILIKE '%bag térmica%' OR pc.nome ILIKE '%bag termica%')
ON CONFLICT DO NOTHING;
```

**2. Remover vínculo errado em "Garrafas e Squeezes"** apenas para esses produtos:
```sql
DELETE FROM product_spotlight_categories psc
USING products_cache pc
WHERE psc.product_id = pc.id
  AND psc.category_id = '59e0b987-ee37-45da-869c-9ab62f16e607'
  AND (pc.nome ILIKE '%bolsa térmica%' OR pc.nome ILIKE '%bolsa termica%'
       OR pc.nome ILIKE '%lancheira%' OR pc.nome ILIKE '%cooler bag%'
       OR pc.nome ILIKE '%bag térmica%' OR pc.nome ILIKE '%bag termica%');
```

> **Garrafas/squeezes térmicas** (com "garrafa térmica" ou "squeeze térmico" no nome) **continuam** em Garrafas e Squeezes — o filtro acima só pega itens que começam/contêm "bolsa térmica", "lancheira", "cooler bag" e "bag térmica". Esses são os reais "bolsas térmicas".

### Por que estavam lá
A sync herdou categorização de uma versão antiga das regras de `autoCategorize.ts` que mapeava bolsas térmicas para o slug `bolsas-termicas` (que não existe mais como categoria ativa) e o fallback acabou caindo em `garrafas-e-squeezes`. Como você mesmo disse que ajustes futuros serão pontuais via edição manual de produto, **não** vou tocar em `autoCategorize.ts` agora — apenas corrijo os dados existentes.

### Validação pós-migration
Após rodar, execute na UI: a categoria "Bolsas" mostrará +N bolsas térmicas, "Garrafas e Squeezes" deixará de exibir esses itens. Edição manual em `/admin/produtos/{id}` continua funcionando para casos isolados.

### Arquivos
- 1 migration de dados (INSERT + DELETE em `product_spotlight_categories`).
- Sem alteração de schema, sem alteração de código frontend.

