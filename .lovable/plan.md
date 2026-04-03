

# Plano: Produto no catálogo + fixes

## 3 entregas

### 1. Criar página de produto exclusiva do catálogo (`/catalogo/produto/:slug`)

**Nova rota**: `/catalogo/produto/:slug` em `App.tsx`

**Novo arquivo**: `src/pages/CatalogProductDetail.tsx`
- Baseado na estrutura do `ProductDetail.tsx` existente (galeria, variantes, preço, tabela de quantidades, dimensoes, lightbox)
- Usa `CatalogHeader` e `CatalogFooter` no lugar de `Header`/`Footer`
- **Substituir** o botao "Solicitar orcamento no WhatsApp" por botao **"Adicionar ao orcamento"** (verde, usa `useQuotation().addItem`)
- Manter seletor de quantidade (+/- e input)
- **Apos adicionar**: exibir dois botoes:
  - "Continuar escolhendo" → volta para `/catalogo` (preservando filtros via `navigate(-1)`)
  - "Enviar orcamento via WhatsApp" → abre WhatsApp direto (mesma logica do QuotationDrawer)
- Remover: Breadcrumbs do site, HowItWorks, produtos relacionados com ProductCard do site, FloatingWhatsApp do site
- Manter: QuotationBar no topo + QuotationDrawer

**Atualizar link nos cards**: Em `CatalogProductCard.tsx`, mudar `href` de `/produto/${slug}` para `/catalogo/produto/${slug}`

### 2. Fix: botao "Enviar orcamento via WhatsApp" no QuotationDrawer

**Arquivo**: `src/components/catalog/QuotationDrawer.tsx`

O `WHATSAPP_NUMBER` tem o valor `5548996652844`. O `window.open` com `https://wa.me/...` deve funcionar. Vou verificar se o problema e o formato do numero ou encoding. O numero parece correto (55 + DDD + numero). Possivel causa: o `window.open` esta sendo bloqueado por popup blocker porque nao e disparado diretamente por click do usuario (improvavel, pois esta em onClick). Outra causa: o botao pode nao estar recebendo o click. Vou garantir que o `onClick` esta no `Button` correto e adicionar `type="button"`.

### 3. Mobile: dropdown de categoria com estilo igual ao desktop

**Arquivo**: `src/components/catalog/CatalogMobileFilters.tsx`

Substituir o `<select>` nativo por um dropdown customizado identico ao desktop (`CatalogFilterBar.tsx`): botao arredondado com borda verde quando selecionado + lista suspensa posicionada com `absolute`. Usar o mesmo estilo visual do desktop (rounded-lg, border verde ativo, hover suave).

## Arquivos afetados

- **Criar**: `src/pages/CatalogProductDetail.tsx`
- **Editar**: `src/App.tsx` (nova rota)
- **Editar**: `src/components/catalog/CatalogProductCard.tsx` (mudar href)
- **Editar**: `src/components/catalog/QuotationDrawer.tsx` (fix botao WhatsApp)
- **Editar**: `src/components/catalog/CatalogMobileFilters.tsx` (dropdown customizado)

## Nao alterar
- `ProductDetail.tsx` (pagina do site)
- Header, Footer, HeroSection do site
- Nenhum componente global

