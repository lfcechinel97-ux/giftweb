# Plano: Picker de categorias agrupadas no /catalogo

Hoje a página `/catalogo` lista as 32 categorias base em uma lista plana (longa e ocupa muita tela). Vou trocar essa lista pelo mesmo padrão usado na home — agrupada por seção (Copos/Garrafas/Canecas, Mochilas/Bolsas/Malas, etc.), com cada grupo expansível para mostrar as subcategorias, e busca por nome.

## O que muda

1. **Criar `CatalogGroupedCategoryPicker`** (`src/components/catalog/CatalogGroupedCategoryPicker.tsx`)
   - Baseado no `HeroCategoryPicker` da home, mas com o visual do catálogo (fundo branco, borda `#E5E7EB`, acento verde `#22C55E`, tipografia menor/densa).
   - Usa `CATEGORY_GROUPS` (já existe em `src/config/categoryGroups.ts`) para o agrupamento.
   - Usa `useBaseCategories()` para pegar os labels reais do banco.
   - Botão fechado mostra a categoria atual (ou "Todas as categorias").
   - Aberto: campo de busca + lista de grupos expansíveis. Buscando, vira lista plana de resultados.
   - "Todas as categorias" no topo para limpar.

2. **Desktop — `CatalogFilterBar.tsx`**
   - Substituir o dropdown atual de categorias (linhas ~94–135, lista plana) pelo novo picker agrupado.
   - Mantém o resto da barra (preço, cor, ordenação, busca) intacto.

3. **Mobile — `CatalogMobileFilters.tsx`**
   - Trocar o dropdown plano de categorias (passo "1 Categoria") pelo mesmo picker agrupado.
   - Mantém o "stepBadge" e o restante do fluxo (preço, cor) iguais.

4. **Sidebar desktop antigo — `CatalogSidebar.tsx`**
   - Esse componente não está sendo renderizado em `CatalogPage` (que usa `CatalogFilterBar`), então **não vou mexer** para não criar trabalho à toa.

## Fora de escopo

- Não altero `CatalogStoryCategories` (carrossel de "stories" do desktop) — continua mostrando as 32 base como atalho visual.
- Não altero `HeroCategoryPicker` nem o agrupamento da home.
- Sem mudanças em backend, filtros, ordenação ou produtos.

## Resultado esperado

No `/catalogo`, tanto no desktop quanto no mobile, o seletor de categoria abre em grupos colapsados (ex.: "Copos, Garrafas e Canecas (4)") e o usuário expande só o grupo que interessa — ocupando muito menos espaço vertical, igual à referência da home enviada na imagem.
