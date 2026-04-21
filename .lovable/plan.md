

## Nova página: Precificação por Categoria

### Rota e menu
- Nova rota admin: `/admin/precificacao` em `src/App.tsx`.
- Novo item no sidebar do `AdminLayout.tsx`: **"Precificação"** (ícone `Calculator` ou `DollarSign`), entre **Categorias** e **Cat. Imagens**.

### Modelo de dados
- Migration: adicionar coluna `tabela_multiplicadores jsonb` em `spotlight_categories`.
  - Formato: `[{ qty: 20, multiplicador: 3.8 }, { qty: 50, multiplicador: 3.7 }, ...]` (mesmo formato já usado em `products_cache.tabela_precos`).
  - Default `null` → significa "usar multiplicadores padrão do sistema" (markup × volume discount).

### UI da página `/admin/precificacao`
- Tabela com uma linha por categoria ativa (busca em `spotlight_categories` ordenando por `category_type` depois `position`).
- Colunas:
  - **Categoria** (label + badge "Base"/"Marketing")
  - **Produtos** (contagem via `product_spotlight_categories`)
  - **Multiplicadores** — 7 inputs lado a lado: `20`, `50`, `100`, `200`, `300`, `500`, `1000+`
  - **Ação** — botão **"Aplicar"** (verde) por linha
- Cada input de multiplicador é um **stepper customizado**:
  - Botão `−` à esquerda (decrementa 0,1)
  - Input numérico central (digitar livremente, formato `2,50` aceitando vírgula ou ponto)
  - Botão `+` à direita (incrementa 0,1)
  - Mínimo 1.0, máximo 10.0, 2 casas decimais
- Header da tabela tem um botão global **"Restaurar padrão"** que preenche todos com markup atual derivado das regras de `price.ts` (apenas visual, só salva ao clicar Aplicar).
- Ao carregar: se a categoria já tem `tabela_multiplicadores`, mostra esses valores; senão mostra o cálculo padrão (markup base × (1 − desconto da faixa)) para a faixa de preço média da categoria como sugestão (read-only label "padrão"), ainda permitindo editar.

### Comportamento "Aplicar"
Ao clicar **Aplicar** na linha de uma categoria:
1. **Confirmação**: dialog com "Aplicar multiplicadores a X produtos da categoria 'Y'? Isso sobrescreve a tabela de preços individual de cada produto."
2. Salva os multiplicadores em `spotlight_categories.tabela_multiplicadores` (memória de qual foi a última config aplicada).
3. Atualiza em massa `products_cache.tabela_precos` para todos os produtos vinculados àquela categoria via `product_spotlight_categories` — gravando exatamente o array `[{qty, multiplicador}]` configurado.
4. Toast verde: "X produtos atualizados".
5. Invalida cache do React Query (`['admin-products']`, etc).

Importante: preserva o `preco_custo` de cada produto (não mexe). Como o front calcula `unit = preco_custo × multiplicador`, o preço final ajusta automaticamente, respeitando custos individuais.

### Ações em lote
- Topo da página: botão **"Aplicar a todas"** (faz a aplicação para todas as categorias ativas com seus multiplicadores atuais — útil para repricing geral).

### Arquivos
- **Migration**: `spotlight_categories.tabela_multiplicadores jsonb`.
- **`src/App.tsx`**: nova rota `precificacao`.
- **`src/pages/admin/AdminLayout.tsx`**: novo item de menu.
- **`src/pages/admin/AdminPricing.tsx`** (novo): página completa com a tabela.
- **`src/components/admin/MultiplierStepper.tsx`** (novo): componente reutilizável `−` / input / `+`.
- **`src/integrations/supabase/types.ts`**: regenerado com novo campo.

### Resultado esperado
- Admin abre `/admin/precificacao`, vê 32+ categorias com seus multiplicadores nas 7 faixas.
- Clica `+` no multiplicador da faixa 100 da categoria "Copos e Canecas" → vai de 3,40 para 3,50.
- Clica **Aplicar** → todos os ~120 produtos de copos têm `tabela_precos` atualizada e o preço da faixa 100 sobe ~3% no site instantaneamente.
- Edição manual de produto continua funcionando e sobrescreve a configuração da categoria (último a salvar vence).

