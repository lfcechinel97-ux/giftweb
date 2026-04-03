

# Plano: Página `/catalogo` com filtros em sidebar, grid de produtos e carrinho de orçamento

## Resumo

Criar uma nova página `/catalogo` com layout de duas colunas (sidebar de filtros + grid de produtos), hero compacto, drawer lateral de orçamento e integração com o menu de navegação existente.

## Arquivos a criar

### 1. `src/pages/CatalogPage.tsx` — Página principal
- Hero compacto: título "Explore nosso catálogo de *brindes*" + subtítulo, fundo com gradiente verde sutil (identidade Gift Web)
- Layout duas colunas: sidebar fixa 320px + grid 4 colunas (desktop), full-width no mobile
- Reutiliza `Header`, `Footer`, `FloatingWhatsApp`, `ProductCard`, `CatalogPagination`
- Usa a RPC `search_products_global` (mesma do AllProducts) para busca server-side
- Lê query params da URL: `categoria`, `cor`, `preco_min`, `preco_max`, `q`, `page`
- Estado local para filtros, sincronizado com URL

### 2. `src/components/catalog/CatalogSidebar.tsx` — Sidebar de filtros (desktop)
- **Busca por texto**: input com ícone de lupa
- **Categorias**: lista de checkboxes com todas as categorias base (via `useBaseCategories`), clicáveis para filtrar
- **Faixa de preço**: slider dual-handle (Radix Slider do shadcn) + inputs manuais min/max
- **Cor**: swatches coloridos clicáveis (reutiliza lógica de `getCorHex`/`isLightColor`)
- **Estoque**: toggle "Apenas com estoque"
- Botão "Limpar filtros"
- Sticky no desktop (`sticky top-24`)

### 3. `src/components/catalog/CatalogMobileFilters.tsx` — Filtros mobile (fullscreen modal)
- Abre via botão "Filtrar" visível apenas no mobile
- Modal fullscreen com scroll interno
- Mesmos filtros da sidebar
- Botões "Aplicar" (fecha e aplica) e "Limpar"

### 4. `src/components/catalog/QuotationDrawer.tsx` — Drawer lateral de orçamento
- Drawer pela direita (usa componente Sheet do shadcn)
- Lista de itens adicionados com: imagem, nome, quantidade editável, preço unitário
- Botão "Remover" por item
- Total estimado no rodapé
- Botão "Enviar orçamento via WhatsApp" que monta mensagem formatada e abre link do WhatsApp
- Estado gerenciado via context (`QuotationContext`) com `localStorage` para persistência

### 5. `src/contexts/QuotationContext.tsx` — Context do carrinho de orçamento
- `addItem(product, qty)`, `removeItem(id)`, `updateQty(id, qty)`, `clearAll()`, `items`, `totalItems`
- Persiste em `localStorage`
- Provider envolvendo o App

### 6. `src/components/catalog/QuotationBar.tsx` — Barra/botão flutuante do orçamento
- Botão fixo no topo ou flutuante mostrando quantidade de itens selecionados
- Ao clicar, abre o `QuotationDrawer`

## Arquivos a editar

### 7. `src/App.tsx`
- Adicionar rota `/catalogo` → `CatalogPage` (lazy-loaded)
- Envolver app com `QuotationProvider`

### 8. `src/components/Header.tsx`
- Adicionar link "Catálogo" no menu de navegação (desktop e mobile)
- Posicionar após o logo ou como item principal na barra de navegação

### 9. `src/components/ProductCard.tsx`
- Adicionar botão "Adicionar ao orçamento" (ícone `+`) que aparece on hover no card
- Usa `useQuotation()` do context para adicionar o produto

## Detalhes técnicos

- **Grid responsivo**: `grid-cols-2 md:grid-cols-3 lg:grid-cols-4`
- **Sidebar**: hidden no mobile (`hidden lg:block`), substituída pelo modal fullscreen
- **Paginação**: mesma do `AllProducts` com `CatalogPagination`
- **RPC**: `search_products_global` já suporta todos os filtros necessários (cor, preço, estoque, busca, sort, paginação)
- **Categorias no filtro**: mapeiam para slugs que são passados como parâmetro à RPC existente; se a RPC `search_products_global` não aceita filtro por categoria, será necessário usar `search_products_by_category` ou adicionar o parâmetro
- **Cores**: busca cores disponíveis via query direta ou RPC existente
- **WhatsApp**: reutiliza `FloatingWhatsApp` existente + lógica de montagem de mensagem no drawer

## Fluxo do usuário

1. Acessa `/catalogo` via menu ou URL direta
2. Vê hero compacto + grid com todos os produtos
3. Filtra pela sidebar (desktop) ou modal (mobile)
4. Clica `+` no card para adicionar ao orçamento
5. Vê contador atualizar no botão flutuante do orçamento
6. Abre drawer lateral para revisar itens, ajustar quantidades
7. Clica "Enviar orçamento via WhatsApp" → abre WhatsApp com lista formatada

## Não alterar
- HeroSection da homepage
- Filtro de preço da homepage
- Badge "mais pedido"
- Slider existente
- Páginas existentes (`AllProducts`, `CategoryPage`, `SearchPage`)

