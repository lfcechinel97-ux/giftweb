

# Reordenar seções do CatalogProductDetail — Desktop + Mobile

## Arquivo: `src/pages/CatalogProductDetail.tsx`

### Layout Desktop (md:grid-cols-2)

**Coluna esquerda:**
1. Galeria (imagem + thumbs)
2. Descrição
3. Dimensões (altura, largura, etc.) — **movido de direita para esquerda**

**Coluna direita:**
1. Nome
2. Prazo
3. Variantes (cores)
4. Stock badge
5. Preço
6. Qty selector + Adicionar ao orçamento — **movido para cima**
7. Compre com desconto (tabela) — **movido para baixo do botão**
8. Trust text (personalização, entrega)

### Layout Mobile (single column, usando `order-` classes)

Ordem sequencial:
1. Galeria (foto + thumbs)
2. Variantes
3. Preço + Qty + Adicionar ao orçamento
4. Compre com desconto (tabela)
5. Descrição
6. Dimensões

**Implementação**: Extrair variantes, stock+preço, qty+add, tabela, descrição e dimensões como blocos separados com classes `order-N md:order-none`. No desktop, renderizar descrição e dimensões dentro da coluna esquerda e o resto na direita. No mobile, usar order para resequenciar tudo em coluna única.

Abordagem mais limpa: usar layout condicional com blocos que aparecem em locais diferentes via `hidden md:block` / `md:hidden` para os elementos que mudam de coluna (descrição e dimensões).

### Detalhes técnicos

- Mover bloco de dimensões (linhas 458-486) para depois da descrição na coluna esquerda
- Mover qty selector + CTA (linhas 533-598) para logo após o bloco de preço, antes da tabela
- No mobile: renderizar variantes, preço, qty, tabela fora do grid de 2 colunas, usando `md:hidden` duplicado ou order classes
- Nome e prazo ficam no topo da coluna direita (desktop) e acima das variantes (mobile)

### Não alterar
- Nenhum componente fora de /catalogo
- Lógica de cálculo de preço, variantes, lightbox
- CatalogHeader, CatalogFooter, QuotationDrawer

