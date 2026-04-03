

# Correções na página /catalogo — Bugs e melhorias visuais

## Problemas identificados

1. **Scroll para o topo ao clicar**: O `handleCategorySelect` (linha 154 do CatalogPage) faz `scrollIntoView` para `#catalog-products`, e o `setSearchParams` em vários lugares causa re-render que pode rolar a página. Além disso, clicks nos stories e filtros estão trigando navegação/scroll indesejado.

2. **Texto instrucional feio**: Está tudo numa linha só, genérico.

3. **"Faixa de preço" → "Quanto você quer investir?"**: Renomear label.

4. **Cor sem subtexto**: Adicionar "Se não tem preferência, basta não selecionar" abaixo do título.

5. **Cores bugadas**: As bolinhas usam `CATALOG_SWATCH_COLORS` mas podem não estar renderizando por algum problema de estilo (bg inline vs class). Verificar e garantir que todas apareçam.

6. **"X produtos encontrados"**: Remover.

## Alterações

### Arquivo 1: `src/components/catalog/CatalogFilterBar.tsx`

**Instrução como passo-a-passo visual (substituir linha 84-86)**:
- Remover o parágrafo de texto corrido
- Em cada seção (Categoria, Preço, Cor), adicionar um badge numérico no canto superior esquerdo do bloco:
  - Seção Busca+Categoria: badge "1º" + label "Selecione a categoria" em verde/bold
  - Seção Preço: badge "2º" + label "Quanto você quer investir?" em verde/bold
  - Seção Cor: badge "3º" + label "Qual cor você deseja?" + subtexto "Se não tem preferência, basta não selecionar" em muted/italic

**Renomear labels**:
- "Faixa de preço" → "Quanto você quer investir?" (linha 148)
- "Cor" → "Qual cor você deseja?" (linha 213)

**Remover "X produtos encontrados" (linhas 271-306)**:
- Manter apenas os chips de filtros ativos + "Limpar tudo", sem o contador

**Cores — garantir renderização**:
- Verificar que `backgroundColor` inline está sendo aplicado. O código parece correto (`swatch.bg`), mas pode haver um conflito de CSS. Garantir que os spans tenham `display: inline-block` ou similar para renderizar o background.

### Arquivo 2: `src/components/catalog/CatalogMobileFilters.tsx`

- Mesmas renomeações: "Quanto você quer investir?" e "Qual cor você deseja?" + subtexto
- Garantir cores renderizando corretamente

### Arquivo 3: `src/pages/CatalogPage.tsx`

**Corrigir scroll indesejado**:
- Remover o `scrollIntoView` da função `handleCategorySelect` (linha 154)
- No `useEffect` que sincroniza searchParams (linhas 122-132), isso não deveria causar scroll. O problema pode ser o `setSearchParams` com `replace: true` que re-renderiza e o browser volta ao topo. Adicionar `scroll: false` ou prevenir scroll no setSearchParams.

## Não alterar
- HeroSection, Header, Footer do site
- CatalogHeader, CatalogFooter, CatalogStoryCategories
- Slider, QuotationDrawer, ProductCard
- Nenhum componente fora de /catalogo

