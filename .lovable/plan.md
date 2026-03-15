

## Problem

The "Brindes mais procurados pelas empresas" section is empty because the 8 hardcoded product codes (`FEATURED_PRODUCT_CODES`) no longer exist in the database — they return zero results.

## Solution

Replace the hardcoded product codes approach with a dynamic query that fetches **1 product per category** for the 6 requested categories: garrafas, copos, mochilas, kits, bolsas, escritorio.

### Changes

**1. `src/hooks/useHomepageData.ts` — Replace `fetchFeaturedProducts`**

Remove the `FEATURED_PRODUCT_CODES` array and replace `fetchFeaturedProducts` with a function that:
- Queries `products_cache` using `DISTINCT ON (categoria)` via an RPC call, OR uses 6 parallel queries (one per category, `limit 1`, ordered by `estoque DESC`)
- Targets categories: `garrafas`, `copos`, `mochilas`, `kits`, `bolsas`, `escritorio`
- Filters: `ativo = true`, `has_image = true`, `is_variante = false`, `estoque > 0`
- Orders by highest stock to get the most representative/available product

Since `DISTINCT ON` isn't available via the JS SDK, the approach will be **6 parallel single-product queries** — one per category:

```typescript
const FEATURED_CATEGORIES = ["garrafas", "copos", "mochilas", "kits", "bolsas", "escritorio"];

async function fetchFeaturedProducts(): Promise<ProductCache[]> {
  const results = await Promise.all(
    FEATURED_CATEGORIES.map(cat =>
      supabase
        .from("products_cache")
        .select("id,nome,slug,image_url,cor,preco_custo,categoria,estoque,codigo_amigavel,descricao,variantes,variantes_count")
        .eq("categoria", cat)
        .eq("is_variante", false)
        .eq("ativo", true)
        .eq("has_image", true)
        .gt("estoque", 0)
        .order("estoque", { ascending: false })
        .limit(1)
        .single()
    )
  );
  return results
    .map(r => r.data)
    .filter((p): p is ProductCache => p !== null);
}
```

**2. `src/components/BestSellersSection.tsx` — Update skeleton count**

Change skeleton count from 7 to 6 to match the new product count.

No other changes needed — the component already receives and renders `products` generically.

### Notes
- The products will be ordered by stock descending, so the most available product in each category shows first
- Some category products may not look ideal (e.g., "garrafas" category includes bottle openers). If the user wants specific products, we can switch back to manual codes after identifying valid ones.

