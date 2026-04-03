

# Correções no /catalogo — 6 ajustes

## 1. Desktop: inverter Busca ↔ Categoria (`CatalogFilterBar.tsx`)
Trocar a ordem dos campos na linha 1: **Categoria** primeiro (flex-[2]), **Buscar produto** depois (flex-[3]). Assim o dropdown fica alinhado com o "1º Selecione a categoria".

## 2. Scroll para o topo — causa raiz (`App.tsx`)
O `ScrollToTop` (linha 40) escuta `search` (query string). Toda vez que um filtro muda no catálogo, a URL muda e dispara `window.scrollTo(0, 0)`. Solução: remover `search` da dependência do useEffect, mantendo apenas `pathname`. Isso corrige o bug globalmente sem afetar outras páginas.

## 3. Cores vazias — bug de display (`CatalogFilterBar.tsx` + `CatalogMobileFilters.tsx`)
O `<span>` com `w-10 h-10` (desktop) e `w-8 h-8` (mobile) é um elemento inline por padrão — `width`/`height` não funcionam em elementos inline. Adicionar `block` ou `inline-block` ao className das bolinhas de cor em ambos os arquivos.

## 4. Remover badge "mais pedido" do botão "Até R$50" (`CatalogFilterBar.tsx` + `CatalogMobileFilters.tsx`)
- Remover `badge: true` do array `QUICK_PRICES`
- Remover o bloco condicional `{qp.badge && (...)}` que renderiza o Medal + texto
- Remover a classe especial `border-amber-400/50` do botão — todos os botões ficam iguais

## 5. Mobile: Categoria como lista suspensa (`CatalogMobileFilters.tsx`)
Substituir os chips de categorias dentro do `Collapsible` por um `<select>` nativo (dropdown). Quando o usuário abre o accordion, vê um select com todas as categorias. Ocupa uma linha só, sem empurrar a página.

## 6. Mobile: remover Stories de categorias (`CatalogPage.tsx`)
Remover o `<CatalogStoryCategories>` do bloco `lg:hidden` (linhas 192-195). Manter apenas no desktop.

## Arquivos afetados
- `src/App.tsx` — remover `search` do ScrollToTop
- `src/components/catalog/CatalogFilterBar.tsx` — inverter campos, cor block, remover badge
- `src/components/catalog/CatalogMobileFilters.tsx` — cor block, remover badge, select de categoria
- `src/pages/CatalogPage.tsx` — remover stories no mobile

## Não alterar
- Nenhum componente fora de /catalogo (exceto o fix pontual no ScrollToTop)
- HeroSection, Header, Footer do site
- Lógica RPC, QuotationContext, ProductCard

