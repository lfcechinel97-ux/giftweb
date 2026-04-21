
## Problema real

Há dois problemas separados:

1. **Preço ainda “buga” após editar no admin**
   - A correção anterior tratou só a tabela “Compre com desconto”.
   - Mas a PDP ainda usa o cálculo padrão em outros pontos (`precoMin`, `precoAtual`, total, mensagem do WhatsApp), ignorando a `tabela_precos` customizada.
   - Resultado: parte da tela usa a tabela nova e outra parte usa a regra antiga, o que mantém inconsistência e pode continuar quebrando quando preço/multiplicador são alterados.

2. **Ocultar no admin não some do site**
   - Hoje o admin oculta só o **produto pai**.
   - As **variantes** continuam com `is_hidden = false`.
   - Além disso, `ProductDetail.tsx` e `CatalogProductDetail.tsx` buscam por `slug` sem filtrar `is_hidden`, então links diretos continuam abrindo o produto oculto.

## Correção

### 1. Centralizar toda a leitura de preço customizado
Criar um helper único em `src/utils/price.ts` para normalizar a tabela de preços e calcular:

- linhas da tabela por quantidade
- menor preço real (“A partir de”)
- preço unitário da quantidade selecionada
- total do pedido
- fallback para a regra padrão quando não houver tabela customizada válida

Esse helper vai:
- aceitar ambos os formatos:
  - `[{ qty, multiplicador }]`
  - `[{ quantidade, desconto }]`
- aceitar valores numéricos ou string
- ignorar linhas inválidas
- nunca retornar `NaN`

### 2. Usar esse helper em todas as saídas da PDP
Atualizar **as duas páginas**:
- `src/pages/ProductDetail.tsx`
- `src/pages/CatalogProductDetail.tsx`

Trocar estes cálculos isolados:
- `precoMin`
- `precoAtual`
- `tableRows`
- total (`precoAtual * qty`)
- preço enviado no WhatsApp do catálogo

Por uma única fonte de verdade baseada no helper novo.

Assim, quando o admin altera preço de custo + multiplicadores, todos os blocos da tela passam a refletir exatamente o mesmo cálculo.

### 3. Corrigir ocultação para pai + variantes
Hoje o admin lista só produtos pai, mas o hide/show precisa afetar o grupo inteiro.

Vou implementar uma função de backend para admin, algo como:
- `admin_set_product_visibility(p_product_id, p_hidden boolean)`

Ela vai:
- identificar o pai correto
- atualizar o próprio pai
- atualizar todas as variantes ligadas por `produto_pai`

Depois trocar o admin para usar essa função em:
- `src/pages/admin/AdminProducts.tsx` (ocultar individual e em massa)
- `src/pages/admin/AdminProductEdit.tsx` (salvar `is_hidden` no editor completo)

### 4. Bloquear acesso a produto oculto nas páginas públicas
Mesmo com o update em lote, a PDP precisa ser defensiva.

Em:
- `src/pages/ProductDetail.tsx`
- `src/pages/CatalogProductDetail.tsx`

ajustar a busca inicial para:
- não abrir produto com `is_hidden = true`
- se o slug for de variante, carregar o pai e verificar se o pai está oculto
- se estiver oculto, redirecionar (`/404` no site principal e `/catalogo` no catálogo)

### 5. Manter o site sincronizado visualmente
No admin, além do update no backend:
- manter update otimista na lista
- invalidar também as chaves públicas relevantes após salvar/ocultar:
  - `homepage-data`
  - listas do catálogo
  - listas de busca
- ajustar o texto do toast para não sugerir atraso quando o dado já estiver sendo persistido corretamente

## Arquivos

### Backend
- nova migration com `admin_set_product_visibility(...)`

### Frontend
- `src/utils/price.ts`
- `src/pages/ProductDetail.tsx`
- `src/pages/CatalogProductDetail.tsx`
- `src/pages/admin/AdminProducts.tsx`
- `src/pages/admin/AdminProductEdit.tsx`

## Resultado esperado

- Alterar **preço de custo** e **multiplicadores** no admin deixa:
  - “A partir de”
  - tabela “Compre com desconto”
  - preço por quantidade
  - total
  - mensagem do WhatsApp
  todos coerentes e sem `R$ NaN`.

- Ocultar no admin passa a ocultar:
  - o produto pai
  - todas as variantes
  - links diretos da PDP também deixam de abrir o item oculto.
