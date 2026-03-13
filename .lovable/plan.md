

## Plan: Ajustar ProductCard — bolinhas de cor + remover "Cor: X"

### Problema
1. O texto "Cor: INOX", "Cor: AZUL" etc. aparece nos cards de produtos **sem variantes**, poluindo o catálogo — o cliente vai clicar no produto pai e ver as variações lá dentro.
2. As bolinhas de cor já funcionam para produtos **com variantes**, mas a cor do próprio produto pai não aparece na lista de bolinhas (só mostra as variantes filhas).

### Mudanças no `src/components/ProductCard.tsx`

1. **Remover** o bloco que exibe "Cor: {cor}" (linhas 125-127) — eliminar completamente.

2. **Incluir a cor do produto pai** na lista de bolinhas: quando `hasVariants`, criar um array combinado que inclui o produto pai como primeira bolinha (usando `cor`, `slug`, `estoque` do próprio card) seguido das variantes do JSONB. Isso garante que todas as cores disponíveis apareçam.

3. **Ajustar o contador** de cores: em vez de `variantes.length + 1`, usar o tamanho real do array combinado.

Resultado: todos os cards mostram apenas bolinhas coloridas (sem texto "Cor:"), e a cor do pai aparece junto com as variantes.

