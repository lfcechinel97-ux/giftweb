
Objetivo: corrigir o filtro de cor nas spotlight categories para que “Copos e Canecas + Rosa” traga todos os produtos esperados.

O que eu confirmei
- O frontend está aplicando o filtro de cor corretamente com `.in("cor", ["ROSA"])`.
- O problema real não está mais no parâmetro `cor`.
- Hoje existem no banco:
  - `products_cache`: 70 produtos ativos/com imagem em `categoria='copos'` com cor ROSA
  - `product_spotlight_categories` para `copos-e-canecas`: apenas 2 produtos ROSA mapeados
- Ou seja: a página está filtrando dentro da join table, mas essa join table não contém todas as variantes/produtos rosa dessa categoria.

Plano de correção

1. Ajustar a estratégia da `CategoryPage.tsx`
- Manter o fluxo atual via `product_spotlight_categories` quando não houver filtros, para preservar a curadoria da categoria.
- Quando houver filtro ativo (`cor`, busca e/ou estoque), não limitar o resultado aos IDs da join table.
- Em vez disso, consultar `products_cache` diretamente usando a categoria real da spotlight category.

2. Criar um mapeamento confiável para categorias base
- Adicionar uma constante no `CategoryPage.tsx` ligando o slug da spotlight aos valores reais de `products_cache.categoria`.
- Exemplo inicial:
```ts
const BASE_CATEGORY_MAP: Record<string, string[]> = {
  "copos-e-canecas": ["copos"],
  "garrafas-e-squeezes": ["garrafas"],
  // demais categorias base
};
```
- Para spotlight categories que não forem base ou não estiverem no mapa, manter fallback via join table.

3. Corrigir a query filtrada
- No ramo “com filtros ativos”, usar:
  - `.in("categoria", categoriasReais)`
  - `.eq("ativo", true)`
  - `.eq("has_image", true)`
  - `.in("cor", valoresNormalizados)` quando houver cor
  - remover `is_variante=false` quando houver filtro de cor, para exibir todas as variantes da cor
- Isso fará “copos + rosa” buscar no universo real da categoria, não só nos IDs curados.

4. Corrigir a lista de cores da categoria
- A query que popula `cores` também deve usar a mesma fonte do passo 3 quando a category for base.
- Assim o filtro mostrará as cores existentes no conjunto real da categoria, não apenas no subconjunto da join table.

5. Endurecer normalização de cor
- No `sync-products/index.ts`, manter `CorWebPrincipal` como prioridade e fallback por `CodigoComposto`.
- Além disso, normalizar sempre com `trim().toUpperCase()` antes de salvar em `products_cache.cor`.
- Isso evita casos como `"CHUMBO "` com espaço no final.

6. Validar impacto em `AllProducts.tsx`
- Conferir se lá o filtro continua correto.
- Provavelmente só precisa manter a lógica atual, mas vale revisar para usar a mesma normalização de cor e a mesma regra de variantes.

Arquivos a ajustar
- `src/pages/CategoryPage.tsx`
- `supabase/functions/sync-products/index.ts`
- possivelmente `src/pages/AllProducts.tsx`

Resultado esperado
- `/categoria/copos-e-canecas?cor=ROSA` deixa de retornar só 2 itens e passa a buscar todos os copos rosa ativos com imagem.
- A curadoria por spotlight continua existindo para navegação sem filtros.
- O filtro de cor fica robusto mesmo quando a join table não refletir todas as variantes.

Detalhe técnico importante
- O que está quebrando hoje não é o `.in("cor", ["ROSA"])`; ele está funcionando.
- O bloqueio é este recorte:
```ts
.in("id", productIdsDaSpotlight)
```
- Como apenas 2 produtos rosa estão dentro dessa lista, a página nunca vai mostrar os demais enquanto continuar dependendo dela durante a filtragem.
