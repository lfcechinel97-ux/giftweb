## Problema

O detalhe do produto (site e /catalogo) já respeita a `tabela_precos` customizada de cada produto — por isso mostra "A partir de R$ 4,94" e "20 un: R$ 9,10" na caneta metal touch.

Mas os cards da grade calculam o preço com `calcularPreco(preco_custo, qtd)` — a fórmula padrão de markup — ignorando `tabela_precos`. Por isso a mesma caneta aparece bem mais cara em `/categoria/canetas` e em `/catalogo`.

O RPC `search_products_by_category` (e o do catálogo) já retorna `tabela_precos` via `pc.*`, então o dado está disponível — só não está sendo consumido nos cards.

## Correção

Trocar o cálculo nos dois cards para os helpers que já respeitam a tabela customizada:

- `calcularPreco(preco_custo, 1000)` → `getEffectiveMinPrice(tabela_precos, preco_custo)`
- `calcularPreco(preco_custo, 20)` → `getEffectiveUnitPrice(tabela_precos, preco_custo, 20)`

Produtos sem `tabela_precos` continuam usando a fórmula padrão (o próprio helper faz o fallback), então nada muda para eles.

### Site — `/categoria/*`, busca, todos os produtos

- `src/components/ProductCard.tsx`
  - Adicionar `tabela_precos?: any` nos props.
  - Importar `getEffectiveMinPrice`, `getEffectiveUnitPrice`.
  - Substituir os dois cálculos de `precoMin` e `preco20`.
- `src/pages/CategoryPage.tsx`, `src/pages/AllProducts.tsx`, `src/pages/SearchPage.tsx`, e qualquer outra página que renderize `<ProductCard />`: passar `tabela_precos={p.tabela_precos}`. Confirmar por busca (`rg "<ProductCard"`) e garantir que o objeto do produto vem de `products_cache` (via `pc.*`) — se algum select limitar colunas sem `tabela_precos`, incluir a coluna.

### Catálogo — `/catalogo`

- `src/components/catalog/CatalogProductCard.tsx`
  - Importar `getEffectiveMinPrice`, `getEffectiveUnitPrice`.
  - Substituir os dois cálculos de `precoMin` e `preco20` usando `product.tabela_precos`.
  - `product` já é um registro de `products_cache`, então `tabela_precos` já está disponível — sem mudanças no fetch.

## Fora de escopo

- **`/topprodutos`**: intencionalmente não linkado ao `products_cache`. Continua com preço editável manualmente na `topprodutos_curadoria`, sem nenhum vínculo automático.
- Não alterar `calc_display_price` no banco.
