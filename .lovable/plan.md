
## Bug

Quando você edita os preços no `/admin/produtos`, o `PriceEditor` salva `tabela_precos` no formato novo `[{qty, multiplicador}]`. Mas as páginas de produto (`ProductDetail.tsx` e `CatalogProductDetail.tsx`) ainda leem só o formato legado `[{qty, desconto}]` — acessam `r.desconto` (que vira `undefined`), o cálculo `1 - undefined` resulta em **`NaN`**, e o front mostra "R$ NaN".

## Correção

### 1. `src/pages/ProductDetail.tsx` (memo `tableRows`, linhas 244–264)
Trocar a leitura para suportar **ambos os formatos**:
- Se a row tem `multiplicador` (formato novo do admin) → `unit = preco_custo * multiplicador`, e `desc = 1 - multiplicador / markupBase` (para mostrar o badge "-X%" e o preço base riscado de forma coerente, ou 0 se não der pra inferir).
- Se a row tem `desconto` (formato legado) → manter cálculo atual `preco_custo * markup * (1 - desconto)`.
- Se row não tem nenhum dos dois → ignorar (não gera linha NaN).

### 2. `src/pages/CatalogProductDetail.tsx` (memo `tableRows`, linhas 201–220)
Aplicar exatamente a mesma correção.

### 3. Reaproveitar helper já existente
`src/utils/price.ts` já tem `getCustomMultiplier(tabelaPrecos, precoCusto, qty)` que entende os dois formatos. Vou usá-lo nas duas páginas para deixar a leitura única e à prova de futuro:

```ts
const customRows = Array.isArray(product?.tabela_precos) ? product.tabela_precos : null;
if (customRows?.length) {
  const markup = getMarkup(displayPrecoCusto);
  return customRows
    .map((r: any) => {
      const mult = getCustomMultiplier([r], displayPrecoCusto, r.qty ?? r.quantidade);
      if (mult == null || !r.qty && !r.quantidade) return null;
      const unit = displayPrecoCusto * mult;
      const desc = Math.max(0, 1 - mult / markup);
      return { qty: r.qty ?? r.quantidade, unit, base: precoBase, desc };
    })
    .filter(Boolean);
}
```

### 4. (Defensivo) `PriceEditor` — validação de input
Em `src/pages/admin/AdminProducts.tsx` (`handleSave`, linhas 386–402): rejeitar `multiplicador` `NaN`/`<= 0` antes de enviar pro banco, com toast de erro. Isso impede que um produto fique com tabela quebrada caso o usuário deixe um campo vazio.

## Resultado
- Após editar preços no admin, a tabela "Compre com desconto" mostra valores corretos em R$ (e não mais "NaN").
- Funciona tanto pra produtos editados pelo novo PriceEditor quanto pros antigos com formato `desconto`.
- Editor admin valida antes de salvar.

## Arquivos
- `src/pages/ProductDetail.tsx`
- `src/pages/CatalogProductDetail.tsx`
- `src/pages/admin/AdminProducts.tsx`
