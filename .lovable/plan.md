
## Objetivo
Permitir que o admin edite a tabela "Compre com desconto" de cada produto individualmente — customizando as quantidades e os percentuais de desconto exibidos.

---

## Como funciona hoje
A tabela é 100% calculada em código:
- `QUANTITIES = [20, 50, 100, 200, 300, 500, 1000]` — hardcoded
- `getDesconto(qty)` — tabela fixa em `src/utils/price.ts`
- `calcularPreco(preco_custo, qty)` — aplica markup + desconto

Não há nenhum override por produto no banco.

---

## Solução

### 1. Migração de banco
Adicionar coluna `tabela_precos` (JSONB) na tabela `products_cache`:
```sql
ALTER TABLE products_cache ADD COLUMN tabela_precos jsonb DEFAULT NULL;
```
Estrutura do JSON:
```json
[
  { "qty": 20,   "desconto": 0 },
  { "qty": 50,   "desconto": 0 },
  { "qty": 100,  "desconto": 0.04 },
  { "qty": 200,  "desconto": 0.07 },
  { "qty": 300,  "desconto": 0.09 },
  { "qty": 500,  "desconto": 0.12 },
  { "qty": 1000, "desconto": 0.16 }
]
```
Quando `NULL`, o produto usa os valores globais padrão (comportamento atual).

---

### 2. Admin — `AdminProductEdit.tsx`
Adicionar seção "Tabela de Preços" no painel direito, abaixo da descrição e acima dos toggles.

A seção mostrará uma tabela editável com as 7 linhas:
- **Qtd**: campo numérico editável (ex: 20, 50, 100...)
- **Desconto (%)**: campo numérico editável (ex: 0, 4, 7...)
- **Preço/un calculado**: exibido em tempo real (somente leitura) baseado em `preco_custo`
- Botão **+ Adicionar linha** para inserir novas faixas
- Botão **× remover** em cada linha
- Botão **Resetar para padrão** (limpa `tabela_precos` → volta ao global)

Os dados são salvos junto com o botão "Salvar Alterações" já existente.

---

### 3. Página do produto — `ProductDetail.tsx`
Atualizar `tableRows` useMemo para:
1. Verificar se `product.tabela_precos` existe e é um array não vazio
2. Se sim: usar as linhas customizadas → `{ qty, desconto }` do JSONB
3. Se não: usar o comportamento padrão atual (`QUANTITIES` + `getDesconto`)

Nenhuma mudança visual na página pública, apenas os valores mudam.

---

### Arquivos a editar
- **DB migration** — adicionar coluna `tabela_precos jsonb`
- `src/pages/admin/AdminProductEdit.tsx` — UI do editor de tabela
- `src/pages/ProductDetail.tsx` — leitura da tabela customizada
