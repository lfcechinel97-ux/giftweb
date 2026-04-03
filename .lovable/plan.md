

# Redesenho da página /catalogo — Catálogo Digital limpo

## Resumo
Transformar a página `/catalogo` de um layout "site" para um **catálogo digital limpo e independente**, sem header/footer do site. Criar header próprio com letreiro "Catálogo Digital Gift Web", categorias estilo stories do Instagram, filtro igual ao da homepage (imagem 3), e footer simplificado só com contato/endereços/pagamento.

## Mudanças

### 1. Criar `src/components/catalog/CatalogHeader.tsx` — Header próprio do catálogo
- Letreiro bonito: "Catálogo Digital" em bold + "Gift Web" em verde, tipografia elegante
- Fundo escuro (#0B0F1A) ou branco clean, compacto
- Sem menu de navegação do site, sem barra de busca do header principal
- Ícone do carrinho de orçamento com badge de quantidade (abre o QuotationDrawer)

### 2. Criar `src/components/catalog/CatalogStoryCategories.tsx` — Categorias estilo Stories
- Substituir o bento grid atual por uma **fila horizontal scrollável** estilo stories do Instagram
- Cada categoria: **círculo com borda gradiente** (verde), imagem do produto dentro, nome abaixo
- Scroll horizontal com snap, sem scrollbar visível
- Ao clicar, aplica filtro de categoria e rola para os produtos
- Categoria selecionada fica com borda mais grossa/destacada
- Usa os mesmos dados do `useBaseCategories` + imagem do primeiro produto

### 3. Criar `src/components/catalog/CatalogFooter.tsx` — Footer simplificado
- Fundo escuro (#0B0F1A), compacto
- **Apenas**: telefones, email, endereço matriz + filial, formas de pagamento
- **Remover**: categorias, institucional, SSL, frase, copyright extenso
- Layout: 2-3 colunas simples (Contato | Endereços | Pagamento)

### 4. Atualizar `src/pages/CatalogPage.tsx`
- Trocar `<Header />` por `<CatalogHeader />`
- Trocar `<Footer />` por `<CatalogFooter />`
- Trocar `<CatalogHeroCategories />` por: letreiro hero + `<CatalogStoryCategories />`
- Remover `<Breadcrumbs />`
- Manter: filtros (CatalogFilterBar + CatalogMobileFilters), grid de produtos, paginação, QuotationBar, QuotationDrawer, FloatingWhatsApp
- O bloco de filtro fica logo abaixo das stories (como na imagem 3: categoria dropdown, faixa de preço com botões rápidos + slider, cores, botão "BUSCAR BRINDE")

### 5. Seção Hero do catálogo
- Título grande: "Explore nosso catálogo de **brindes:**" (brindes em verde/itálico, como imagem 3)
- Subtítulo: "Filtre por categoria, preço e cor"
- Abaixo: bloco de filtro compacto (dropdown categoria, preço com botões rápidos + slider + inputs, bolinhas de cor, botão verde "BUSCAR BRINDE")
- Este bloco de filtro é o **mesmo estilo visual** da homepage (imagem 3)

## Não alterar
- Nenhum componente fora de `/catalogo`
- Header.tsx, Footer.tsx do site principal
- HeroSection da homepage
- Filtro de preço da homepage
- Outras páginas (Index, ProductDetail, etc.)

## Arquivos afetados
- **Criar**: `CatalogHeader.tsx`, `CatalogStoryCategories.tsx`, `CatalogFooter.tsx`
- **Editar**: `CatalogPage.tsx`
- **Não editar**: `CatalogHeroCategories.tsx` (pode ficar sem uso, mas não deletar)

