

## O que muda

### 1. Editor admin — preço de custo recalcula a tabela em tempo real
Em `AdminProductEdit.tsx`, a coluna **Preço/un** já é calculada como `precoCustoUI × multiplicador`. Hoje, ao alterar o campo **Preço de custo** (modo Manual), o `precoCustoUI` atualiza, mas a tabela só re-renderiza visualmente — os multiplicadores não mudam (o que está correto). Vou garantir que:

- Ao digitar no campo **Preço de custo** (Manual ON), todas as células da coluna **Preço/un** atualizem instantaneamente (já depende de `precoCustoUI`, só preciso confirmar reatividade — sem cálculo extra).
- Quando o usuário muda **só o multiplicador** de uma linha, o **Preço/un** daquela linha atualiza no ato (já é o caso).
- Adicionar uma 4ª coluna **"Desconto vs. 20"** na tabela do admin, mostrando exatamente o mesmo % que vai aparecer na PDP, com 2 casas decimais. Isso dá feedback visual imediato pro admin: ele altera o multiplicador da faixa 50 e vê na hora "−2,63%".

### 2. PDP — % de desconto baseado no preço da linha de 20 (não no markup base)
Hoje a coluna **Economia** da PDP calcula `desc = 1 - mult/markupBase` e mostra `Math.round(desc * 100)%`. Isso usa o **markup teórico**, não o preço real da primeira faixa. Resultado: se o admin colocar multiplicador 3,80 na faixa 20 e 3,70 na faixa 50, a tela mostra "−3%" arredondado, mesmo o usuário esperando "−2,63%".

Vou trocar a lógica em `getNormalizedPriceRows` (ou na renderização das duas PDPs) para:

```
descPctVs20 = 1 - (unit_da_faixa / unit_da_faixa_20)
```

Onde **faixa 20** é a primeira linha (menor qty). E formatar com 2 casas decimais via `pt-BR` (ex.: `2,63%`).

Ajustes em:
- `src/utils/price.ts`: no `PriceRow`, manter `desc` (compat) e adicionar `descVsFirst` calculado relativo ao primeiro `unit`.
- `src/pages/ProductDetail.tsx` (linha ~620): trocar `Math.round(row.desc * 100)%` por `row.descVsFirst.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})%`.
- `src/pages/CatalogProductDetail.tsx` (linha ~596): mesma troca.

### 3. Linha de 20 (Min) sem desconto
A linha 20 (Min) continua mostrando "—" (já está). Garantir que o cálculo `descVsFirst` da própria linha 20 seja 0 (ou ignorar a renderização do badge quando idx === 0).

### 4. Helper de formatação
Adicionar utilitário em `src/utils/price.ts`:

```ts
export function formatPercent2(frac: number): string {
  return (frac * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + '%';
}
```

Usar nas duas PDPs e na nova coluna do admin.

## Arquivos
- `src/utils/price.ts` — novo `descVsFirst` em `PriceRow`, helper `formatPercent2`.
- `src/pages/admin/AdminProductEdit.tsx` — nova coluna "Desconto vs. 20" na tabela.
- `src/pages/ProductDetail.tsx` — usar `descVsFirst` + `formatPercent2`.
- `src/pages/CatalogProductDetail.tsx` — mesmo.

## Resultado
- Admin altera **preço de custo** → toda a coluna "Preço/un" recalcula no ato.
- Admin altera **multiplicador** de uma faixa → "Preço/un" e "Desconto vs. 20" daquela linha mudam no ato; mesmos números aparecem na PDP pública.
- PDP mostra desconto real entre faixas com 2 casas decimais (ex.: "−2,63%" em vez de "−3%").

