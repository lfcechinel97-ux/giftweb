## SKU do produto na página de detalhe

### Objetivo
Exibir o código SKU do produto na página de detalhe (`/produto/:slug`) de forma discreta e minimalista.

### O que será feito
1. **Adicionar o SKU abaixo da galeria de imagens** (coluna da esquerda), logo após a fila de thumbnails e antes da seção "Descrição".
2. **Mostrar o código da variante ativa** quando o usuário seleciona uma cor diferente; caso contrário, mostra o código do produto base.
3. **Aplicar estilo minimalista**: texto em `text-muted-foreground`, tamanho `text-xs` (ou `text-[11px]`), usando uma fonte monoespaçada (`font-mono`) para reforçar o caráter técnico/corporativo. Exemplo visual:
   ```
   Código: 18637-BRA
   ```
   ou simplesmente:
   ```
   SKU: 18637-BRA
   ```
4. **Ajustar o espaçamento** com `mt-1` e `mb-2` para manter o fluxo visual limpo entre a galeria e a descrição.

### Arquivos alterados
- `src/pages/ProductDetail.tsx` — inserir o elemento do SKU na coluna da galeria.

### Não está no escopo
- Card de produto no catálogo.
- Páginas do sistema B2B.
- Alterações no banco de dados ou na API.