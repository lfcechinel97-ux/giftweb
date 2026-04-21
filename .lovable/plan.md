

## Marcar produtos como "Fora de Estoque" quando todas as variantes estão zeradas

### Problema
Hoje o badge "Fora de Estoque" no card só considera o `estoque` do produto pai. Quando o produto tem variantes (ex.: AGENDA DIÁRIA 2026 com 2 cores), o pai geralmente tem `estoque = 0` mesmo havendo variantes com estoque — e vice-versa: pode parecer disponível na lista mas todas as variantes estarem zeradas. Resultado: usuário clica num produto e descobre só na PDP que está indisponível.

Precisamos calcular **estoque agregado** = max(estoque do pai, soma/max do estoque das variantes) e usar isso para:
1. Mostrar badge "Fora de Estoque" no card.
2. Filtrar via "Apenas em estoque" nos catálogos/busca.
3. Ordenar (`sort_estoque`) corretamente.

### Solução

#### 1. Banco — coluna agregada `estoque_total`
Adicionar coluna `estoque_total integer` em `products_cache`. Para cada produto:
- Se **não tem variantes** (`is_variante = false` e `variantes IS NULL`): `estoque_total = COALESCE(estoque, 0)`.
- Se é **pai com variantes**: `estoque_total = COALESCE(estoque, 0) + soma do estoque de todas as variantes filhas (is_variante = true AND produto_pai = pai.id)`.
- Se é **variante**: `estoque_total = COALESCE(estoque, 0)` (continua individual; cards só mostram pais).

#### 2. Recálculo automático
- Atualizar `set_variantes_por_prefixo()` para recalcular `estoque_total` dos pais ao final do agrupamento (já roda na sync).
- Adicionar trigger `BEFORE INSERT OR UPDATE OF estoque, produto_pai, is_variante` que recalcula `estoque_total` da linha + dispara update no pai se for variante.
- Migration de backfill: rodar uma vez para preencher todos os registros existentes.

#### 3. Atualizar `sort_estoque` para usar `estoque_total`
Trigger `update_sort_estoque` passa a usar `estoque_total` em vez de `estoque`. Garante ordenação "em estoque primeiro" considerando variantes.

#### 4. Atualizar RPCs de busca
- `search_products_by_category` e `search_products_global`: trocar `COALESCE(pc.estoque, 0) > 0` por `COALESCE(pc.estoque_total, 0) > 0` no filtro `p_apenas_estoque`.

#### 5. Frontend — `ProductCard.tsx`
Hoje o card calcula `outOfStock` baseado em `estoque` + `variantes[].estoque` do JSONB. Trocar para usar `estoque_total` (vindo no payload já agregado), mantendo o fallback atual para compatibilidade caso a coluna não exista ainda em algum payload cacheado.

```ts
const outOfStock = (product.estoque_total ?? computeFromVariantes()) === 0;
```

#### 6. Catálogo B2B (`CatalogProductCard.tsx`)
Mesma lógica — badge "Fora de Estoque" baseado em `estoque_total`.

### Arquivos
- **Migration**: nova coluna `estoque_total`, função de recálculo, trigger, backfill, atualização de `set_variantes_por_prefixo` e `update_sort_estoque`.
- **Migration**: atualizar `search_products_by_category` e `search_products_global` para usar `estoque_total` no filtro `p_apenas_estoque`.
- **`src/components/ProductCard.tsx`**: usar `estoque_total` para badge.
- **`src/components/catalog/CatalogProductCard.tsx`**: idem.
- **`src/integrations/supabase/types.ts`**: regenerado.

### Resultado esperado
- "AGENDA DIÁRIA 2026" com 2 variantes zeradas mostra badge **"Fora de Estoque"** direto na lista — sem precisar clicar.
- Filtro "Apenas em estoque" esconde produtos cujas variantes estão todas zeradas.
- Ordenação por relevância empurra esses produtos pro fim (já são "sort_estoque = 1").
- Edição manual de `estoque` ou nova sync recalcula automaticamente via trigger.

