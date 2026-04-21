

## Problemas a resolver

### 1. Contagem zerada na maioria das categorias
A query `supabase.from("product_spotlight_categories").select("category_id")` traz **só 1000 linhas** (limite default do PostgREST). Há ~7.500 vínculos no banco — então só as primeiras categorias contam corretamente, o resto fica em 0 e o botão "Aplicar" é desabilitado (`disabled={cat.product_count === 0}`).

**Correção:** criar uma RPC `get_category_product_counts()` que retorna `[{category_id, count}]` agregado no banco (sem limite), ou usar `select("category_id", { count: "exact", head: true })` em loop por categoria (32 chamadas, mas confiável). Vou usar a RPC — uma chamada só.

### 2. Subdivisão por faixa de preço de custo dentro da categoria
Hoje a tabela tem **uma linha por categoria** com 7 multiplicadores. Vou trocar por **uma linha por (categoria × faixa de preço de custo)**, com as faixas:

```
0,01–0,50 | 0,51–1,00 | 1,01–2,00 | 2,01–5,00 | 5,01–10,00
10,01–20,00 | 20,01–30,00 | 30,01–50,00 | 50,01–70,00 | 70,01+
```

Cada linha mostra **só as faixas que existem na categoria** (ex.: Canetas não terá faixa 70+).

#### UI nova
- Cada categoria vira um **card expansível** (accordion). Fechado mostra: nome + total de produtos + nº de faixas ativas.
- Ao expandir, aparece uma sub-tabela:
  - **Linha** = faixa de preço de custo
  - **Colunas** = `produtos nessa faixa` + 7 inputs (qty 20/50/100/200/300/500/1000+) + botão `Aplicar faixa`
- Botão `Aplicar categoria inteira` no header do card aplica todas as faixas de uma vez.

#### Modelo de dados
Trocar `spotlight_categories.tabela_multiplicadores` (jsonb) de:
```json
[{qty: 20, multiplicador: 3.8}, ...]
```
para:
```json
[
  {min: 0, max: 0.5, tiers: [{qty: 20, multiplicador: 6.0}, ...]},
  {min: 0.51, max: 1, tiers: [...]},
  ...
]
```

Mantém compatibilidade: se vier no formato antigo (array plano de tiers), o front converte para uma única faixa "todas".

#### Detecção automática de faixas
Ao carregar `/admin/precificacao`, para cada categoria, RPC retorna distribuição de produtos por faixa de custo (`get_category_cost_distribution`). Faixas com `count = 0` não aparecem na UI.

#### Aplicação por faixa
Ao clicar `Aplicar` numa faixa específica:
1. Atualiza `spotlight_categories.tabela_multiplicadores` (substitui a faixa correspondente).
2. Atualiza `products_cache.tabela_precos` **somente** dos produtos vinculados àquela categoria **E** com `preco_custo` dentro do range `[min, max]`. Em lotes de 200 IDs.

### 3. Edição manual ainda vence
A edição individual em `AdminProductEdit.tsx` continua sobrescrevendo (último a salvar vence) — comportamento solicitado pelo usuário.

## Arquivos

### Banco
- **Migration**:
  - `CREATE FUNCTION get_category_product_counts()` — retorna `[{category_id uuid, total bigint}]` agregando todos os PSC (sem limite de 1000).
  - `CREATE FUNCTION get_category_cost_distribution(p_category_id uuid)` — retorna `[{bucket text, min numeric, max numeric, total bigint}]` para as 10 faixas fixas, com count > 0.

### Frontend
- **`src/pages/admin/AdminPricing.tsx`** (refatoração):
  - Trocar tabela única por accordion de categorias.
  - Cada accordion expandido busca distribuição de custo via RPC e mostra sub-tabela por faixa.
  - Inputs `MultiplierStepper` por (faixa × qty).
  - Botão `Aplicar faixa` (atualiza só produtos nessa faixa) e `Aplicar categoria` (todas as faixas).
- **`src/utils/price.ts`**: adicionar constante `COST_BANDS` com as 10 faixas e helper `bandForCost(preco_custo) → COST_BAND`.
- **`src/integrations/supabase/types.ts`**: regenerado.

## Resultado esperado

- Página `/admin/precificacao` lista todas as categorias com **contagem real** de produtos (não mais 0).
- Expandindo "Canetas" aparecem só as faixas que existem (ex.: 0,51–1, 1,01–2, 2,01–5) — sem 70+.
- Admin define multiplicadores diferentes por faixa de custo (ex.: caneta de R$ 0,80 com mult 6,0; caneta de R$ 4,00 com mult 3,8).
- `Aplicar faixa` atinge só os produtos dentro do range; o resto da categoria permanece intacto.
- Edição manual em `/admin/produtos/{id}` continua sobrepondo a configuração de categoria.

