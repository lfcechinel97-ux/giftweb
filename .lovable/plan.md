

## Problema Identificado

O Hero navega para `/categoria/garrafas-squeezes?cor=ROSA`. Na CategoryPage, quando há filtros ativos em uma spotlight category, o código faz:

```
.eq("categoria", "garrafas-squeezes")  // ← slug da spotlight, NÃO existe no campo categoria do banco
```

Mas os produtos têm `categoria = "garrafas"` ou `categoria = "copos"`, nunca `"garrafas-squeezes"`. Resultado: 0 produtos.

---

## Solução

Quando filtros estão ativos em uma spotlight category, em vez de usar o slug como valor do campo `categoria`, buscar primeiro os product_ids da join table `product_spotlight_categories` e filtrar por eles.

### Arquivo: `src/pages/CategoryPage.tsx`

Alterar o bloco `hasActiveFilters` dentro de `isSpotlightCategory` (linhas ~94-121):

1. Primeiro buscar o `category_id` da `spotlight_categories` (igual ao fluxo sem filtros)
2. Buscar TODOS os `product_id` da `product_spotlight_categories` para aquela categoria (sem limit de 1000 — usar `.select("product_id").eq("category_id", catId)` com limit explícito alto, ex: 5000)
3. Depois aplicar a query em `products_cache` com `.in("id", productIds)` + os filtros de cor, busca, estoque
4. Remover o `.eq("categoria", category)` que é o causador do bug

O fluxo fica idêntico ao sem filtros, mas adicionando os filtros de cor/busca/estoque na query final.

### Detalhes técnicos

```text
Antes (bugado):
  spotlight + filtro ativo → query products_cache WHERE categoria = 'garrafas-squeezes' AND cor IN ('ROSA')
  → 0 resultados (categoria não existe)

Depois (corrigido):
  spotlight + filtro ativo → busca product_ids via join table → query products_cache WHERE id IN (...ids) AND cor IN ('ROSA')
  → retorna produtos corretos
```

Para lidar com o limite de 1000 rows do Supabase, a query de product_ids usará um range de 0-4999 (apenas IDs, payload pequeno).

