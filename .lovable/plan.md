

## Problema

O mapeamento `SPOTLIGHT_TO_CATEGORIA` agrupa categorias de forma muito ampla:
- `"agendas"` → `["escritorio"]` (retorna canetas, cadernos, blocos, etc.)
- `"power-banks"` → `["outros"]` (retorna chaveiros, guarda-chuvas, etc.)

Quando o filtro de cor está ativo, o código pula a join table e busca direto em `products_cache.categoria`, mas o campo `categoria` tem valores genéricos demais.

## Solução

**Usar SEMPRE a join table `product_spotlight_categories`**, mesmo com filtros ativos. O problema original (poucos resultados) era que a join table tinha apenas ~1000 produtos, mas agora tem 2.468+. Então ela já cobre o inventário corretamente.

### Arquivo: `src/pages/CategoryPage.tsx`

1. **Remover** o mapeamento `SPOTLIGHT_TO_CATEGORIA` inteiro (linhas 19-54)
2. **Remover** o bloco condicional `if (hasActiveFilters && categoriasReais)` (linhas 106-137)
3. **Unificar** toda a lógica para sempre usar a join table:
   - Buscar `category_id` da `spotlight_categories`
   - Buscar `product_ids` da `product_spotlight_categories` (range 0-4999)
   - Aplicar filtros de cor, busca e estoque **sobre** esses IDs
   - Quando filtro de cor estiver ativo, remover `is_variante=false`
4. **Atualizar** a query de cores disponíveis (useEffect de cores) para também usar a join table em vez do mapeamento

### Lógica unificada

```text
Sempre:
  1. Buscar spotlight_categories.id pelo slug
  2. Buscar product_ids via product_spotlight_categories (0-4999)
  3. Query products_cache WHERE id IN (...ids) AND ativo=true AND has_image=true
  4. Se selectedCor → adicionar .in("cor", valores) e NÃO filtrar is_variante
  5. Se !selectedCor → adicionar .eq("is_variante", false)
  6. Aplicar searchTerm, apenasEstoque, sort, paginação
```

### Resultado esperado
- "Agendas + Preto" retorna apenas agendas pretas (não canetas, cadernos, etc.)
- "Power Banks + Preto" retorna apenas power banks pretos (não chaveiros, guarda-chuvas, etc.)
- A curadoria por spotlight é preservada em todos os cenários

