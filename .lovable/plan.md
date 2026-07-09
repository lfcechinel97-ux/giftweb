## Problema

No card de produto (listagens do site), quando a variante "principal" está sem estoque, o card mostra a imagem dela + badge "Fora de Estoque", mesmo quando outras cores do mesmo produto têm estoque. Isso desestimula o clique.

## Objetivo

Só marcar "Fora de Estoque" quando TODAS as variantes estiverem zeradas. Caso contrário, mostrar a imagem e as cores das variantes que **têm estoque**.

## Mudanças (somente `src/components/ProductCard.tsx`)

1. **Selecionar variante de exibição em estoque**
   - Montar `allColorOptions` como já é feito (pai + variantes).
   - Se a opção principal (`image_url`/cor atual) estiver com `estoque === 0` e existir outra opção com `estoque > 0`, usar a primeira variante em estoque como imagem/base do card (imagem inicial, título permanece o mesmo).
   - Se tudo estiver zerado, manter comportamento atual + badge "Fora de Estoque".

2. **Ordenar/filtrar bolinhas de cor**
   - Exibir primeiro as cores com `estoque > 0`.
   - Cores com `estoque === 0` ficam depois, com opacidade reduzida (~40%) e tooltip "Sem estoque" para deixar claro.
   - Manter limite `MAX_DOTS = 6` e o `+N` restante.

3. **Cycle de imagens no hover**
   - Continuar cycling, mas começar pela imagem da variante em estoque escolhida (nova ordem do array `images.current`).

4. **Badge "Fora de Estoque"**
   - Mostrar somente quando `aggregatedStock === 0` (já é a regra, mas confirmar) OU quando não existir nenhuma variante com estoque. Sem mudança na lógica de `estoque_total`.

## Fora do escopo

- Não mudar página de detalhe do produto, catálogo B2B (`CatalogProductCard`), filtros ou RPC.
- Não mudar backend / cache.

## Detalhes técnicos

- Ajustar `images.current` para começar pela imagem da variante em estoque quando o "principal" está zerado.
- Reordenar `allColorOptions` por `estoque` desc antes de fatiar para `MAX_DOTS`.
- Aplicar `opacity: 0.4` no dot quando `v.estoque === 0`; tooltip mostra `${v.cor} — sem estoque`.
