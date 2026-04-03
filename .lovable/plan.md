

# Ajustes no CatalogProductDetail — Preço no mobile + Remover prazo

## Arquivo: `src/pages/CatalogProductDetail.tsx`

### 1. Remover prazo de produção (desktop + mobile)
Deletar o bloco do prazo (linhas 383-387) que mostra o ícone Clock + `PRAZO_PRODUCAO`. Remover também o import de `Clock` e `PRAZO_PRODUCAO` se não forem usados em outro lugar do arquivo.

### 2. Mobile: preço logo após o título
Atualmente a ordem na coluna direita é: Nome → ~~Prazo~~ → Variantes → Stock → Preço → Qty+CTA.

No mobile, o preço deve vir logo após o nome, antes das variantes. Implementação:
- Duplicar o bloco de preço (linhas 474-490) com `md:hidden` logo após o `<h1>` do nome
- Adicionar `hidden md:block` ao bloco de preço original (que fica na posição atual no desktop, entre stock e qty)

Assim:
- **Mobile**: Nome → Preço → Variantes → Stock → Qty+CTA → Tabela → Descrição → Dimensões
- **Desktop**: Nome → Variantes → Stock → Preço → Qty+CTA → Tabela → Trust → (descrição/dimensões na esquerda)

### Não alterar
- Nenhum componente fora de /catalogo
- Lógica de cálculo, variantes, lightbox

