

## Problemas

1. **PriceEditor da lista (`/admin/produtos`)** salva `tabela_precos`, mas o front da PDP ainda mostra preço errado/quebrado. No editor de produto detalhado (que abre no card) funciona porque ele usa `{qty, desconto}`, formato que TODA a leitura legacy entende. O PriceEditor inline salva `{qty, multiplicador}` — formato novo. O bug real: a lista usa `VOLUME_TIERS = [20,50,100,200,500,1000]` (faltam 300), enquanto o editor detalhado usa `[20,50,100,200,300,500,1000]`. Quando salva pela lista, a faixa 300 some — o que aparece no front como inconsistência grande de preço.
2. **Editor detalhado** só permite editar **% desconto**, não multiplicador, e o preço de custo não é editável.
3. **Categoria no editor detalhado** está vazia — a lista é hardcoded com 9 slugs antigos (`garrafas`, `copos`, `kits`...) que não batem com os 32 slugs reais (`garrafas-e-squeezes`, `copos-e-canecas`...). Quando o produto tem `categoria = 'copos-e-canecas'`, o Select não acha a opção e fica em branco.
4. **Sem categorias múltiplas**: a coluna `categoria` é text único. A tabela `product_spotlight_categories` (M:N produto↔categoria) já existe e o front público já lê dela — só falta UI.

## Correção

### 1. Unificar PriceEditor (lista) com o editor detalhado
- `src/utils/price.ts`: mudar `VOLUME_TIERS` para `[20, 50, 100, 200, 300, 500, 1000]` (inclui 300).
- Resultado: salvar pela lista vai gerar a mesma estrutura que o editor detalhado, e a tabela "Compre com desconto" da PDP fica idêntica.

### 2. Editor detalhado: preço de custo + multiplicadores + toggle API/manual
Em `AdminProductEdit.tsx`:
- Adicionar **toggle "Puxar preço de custo da API XBZ"** (default ON).
  - ON → campo `preco_custo` é readonly, mostra valor da API.
  - OFF → campo editável, salva no banco; sync futura **não sobrescreve** (ver passo 4).
- Trocar coluna **"Desconto %"** por **"Multiplicador (×)"** na tabela "Compre com desconto":
  - Input numérico tipo `2.50`.
  - Coluna "Preço/un" recalcula = `preco_custo × multiplicador`.
  - No save, gravar formato `{qty, multiplicador}` (mesmo do PriceEditor da lista).
  - Ao carregar produto existente: converter `{qty, desconto}` legado para multiplicador via `markup × (1 - desconto)` para mostrar na UI.

### 3. Categoria: usar lista real + categorias múltiplas
Em `AdminProductEdit.tsx`:
- Trocar a constante `CATEGORIES` hardcoded por **fetch das `spotlight_categories` ativas** (mesma fonte que a lista do `/admin/produtos` já usa).
- O `Select` da **categoria principal** vai mostrar o slug atual corretamente (ex: "Copos e Canecas").
- Adicionar um bloco **"Categorias adicionais"** abaixo do select principal:
  - Lista de chips/badges das categorias extras já vinculadas (lendo de `product_spotlight_categories`).
  - Botão `+ Adicionar categoria` que abre um Select com as demais categorias disponíveis.
  - Botão `×` em cada chip para remover.
  - No `Salvar`, sincronizar `product_spotlight_categories`:
    - Inserir vínculos novos.
    - Remover vínculos que foram tirados.
    - Garantir que a `categoria` principal também esteja vinculada.
- Resultado: um copo térmico pode estar em "Copos e Canecas" (principal) + "Garrafas e Squeezes" + "Eventos" simultaneamente, e aparece em todas as páginas.

### 4. Proteger preço manual da próxima sync
- Nova coluna em `products_cache`: `preco_custo_manual boolean default false`.
- Quando o admin desliga "Puxar da API" e edita o preço: setar `preco_custo_manual = true`.
- Em `supabase/functions/sync-products/index.ts`: no upsert, **pular `preco_custo`** quando `preco_custo_manual = true` (mantém o valor do admin).

### 5. Visibilidade da lista admin (rápido)
A coluna **Categoria** na lista (`/admin/produtos`) hoje mostra o slug bruto. Mostrar o `label` da categoria (mapear pelo `categories` já buscado).

## Arquivos

### Backend
- Migration: adicionar `preco_custo_manual boolean default false` em `products_cache`.

### Frontend
- `src/utils/price.ts` — adicionar `300` em `VOLUME_TIERS`.
- `src/pages/admin/AdminProductEdit.tsx` — toggle preço de custo, tabela com multiplicador, fetch de categorias, UI de categorias múltiplas.
- `src/pages/admin/AdminProducts.tsx` — exibir label da categoria em vez do slug.

### Edge Function
- `supabase/functions/sync-products/index.ts` — preservar `preco_custo` quando `preco_custo_manual = true`.

## Resultado esperado

- Editar preço pela **lista** ou pelo **editor detalhado** produz exatamente o mesmo efeito no site.
- Editor detalhado mostra preço de custo (com toggle API/manual) + multiplicadores ao lado de cada faixa, com preço final calculado em tempo real.
- Categoria do produto aparece preenchida ao abrir o editor; alterar reflete imediatamente no site.
- Possível vincular o mesmo produto a várias categorias (chips com `+` e `×`).
- Próxima sync da API não sobrescreve preços editados manualmente.

