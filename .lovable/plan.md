

## Plano de Execução

### Problema
- `product_spotlight_categories` tem ~2.788 produtos de ~10.700 ativos (74% invisíveis nas categorias)
- `SearchPage` ignora parâmetro `cor` da URL
- `HeroSection` não passa `cor` na URL quando busca sem categoria
- Queries no frontend limitadas pelo tamanho da join table

### Solução em 5 passos

#### 1. Migration SQL — Criar 3 RPCs server-side

**`search_products_by_category`**: Recebe slug, cor[], search, apenas_estoque, sort, page, page_size. Faz JOIN interno entre `spotlight_categories` + `product_spotlight_categories` + `products_cache`. Quando cor ativa, inclui variantes. Retorna JSON com rows + total_count.

**`search_products_global`**: Mesma lógica mas sem categoria (busca no `products_cache` inteiro via campo `busca`). Usado pelo SearchPage.

**`get_category_colors`**: Recebe slug, retorna lista de cores distintas disponíveis na categoria via join table.

#### 2. Sync — Expandir categorização + auto-popular join table

No `supabase/functions/sync-products/index.ts`:

- Expandir `getCategoria()` de 7 para 32 categorias granulares (agendas, blocos, cadernetas, canetas, etc. em vez de agrupar tudo em "escritorio")
- Adicionar novo Stage 5 após a RPC de variantes: buscar todos os `products_cache` ativos, mapear cada um para o `spotlight_categories.id` correspondente baseado no campo `categoria`, e inserir em `product_spotlight_categories` com upsert (on conflict do nothing)
- Isso popula a join table com todos os 10.700+ produtos automaticamente a cada sync

#### 3. CategoryPage.tsx — Usar RPC

Substituir toda a lógica de `fetchProductIds()` + query separada por uma única chamada:
```typescript
const { data } = await supabase.rpc("search_products_by_category", {
  p_category_slug: category,
  p_cor: corValues,
  p_search: searchTerm || null,
  p_apenas_estoque: apenasEstoque,
  p_sort: sortBy,
  p_page: page,
  p_page_size: PAGE_SIZE
});
```
Usar `get_category_colors` para popular o filtro de cores.

#### 4. SearchPage.tsx — Adicionar filtro de cor

- Ler `cor` da URL
- Aplicar `.in("cor", corValues)` quando presente
- Remover `is_variante=false` quando cor ativa
- Adicionar CatalogFilters visual (mesmos filtros do CategoryPage)
- Preservar `cor` na paginação

#### 5. HeroSection.tsx — Passar cor na busca

Linha 77: adicionar `cor` na URL quando busca sem categoria:
```typescript
navigate(`/busca?q=${encodeURIComponent(q)}${colorValues ? `&cor=${encodeURIComponent(colorValues)}` : ""}`);
```

### Arquivos a criar/editar
1. **Migration SQL** — 3 RPCs
2. **`supabase/functions/sync-products/index.ts`** — getCategoria expandido + Stage 5
3. **`src/pages/CategoryPage.tsx`** — usar RPC
4. **`src/pages/SearchPage.tsx`** — filtro de cor + CatalogFilters
5. **`src/components/HeroSection.tsx`** — cor na URL de busca

### Resultado
- Todas as 32 categorias com todos os produtos (não apenas 2.788)
- Filtro de cor funciona em todas as páginas (categoria, busca, todos)
- Performance: 1 chamada RPC em vez de 2-3 queries encadeadas
- Após rodar sync, join table terá 10.700+ entradas

