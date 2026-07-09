
## Objetivo

Criar uma coleção temática "Dia dos Pais" que agrupa produtos existentes por prefixo de código. O produto continua aparecendo nas suas categorias normais e passa a aparecer também nessa coleção. Link em destaque azul no topo do site e da navegação do catálogo B2B.

## Escopo

### 1. Backend (banco de dados)

Criar tabela `public.product_collections` para armazenar coleções temáticas reutilizáveis (Dia dos Pais agora, Natal / Dia das Mães depois):

- `slug` (único), `nome`, `titulo_destaque`, `descricao`, `cor_destaque` (hsl/hex), `ativo`, `ordem`
- Tabela filha `public.product_collection_items` com `collection_id` + `codigo_prefixo`

RLS: leitura pública (`anon`, `authenticated`); escrita apenas para admins via `has_role`.

Popular via seed a coleção `dia-dos-pais` com os 60 prefixos enviados (normalizando: `18645l` → `18645L`, `kit18639` → `KIT18639`, remover `(inicio)`).

Criar RPC `search_products_by_collection(p_slug, p_cor, p_search, p_apenas_estoque, p_sort, p_page, p_page_size, p_preco_min, p_preco_max)` — mesma assinatura de `search_products_by_category`, mas filtrando `products_cache` por `codigo_prefixo IN (...)` da coleção. Retorna um representante por prefixo (produto pai), respeitando as regras existentes de estoque/preço.

### 2. Site público (giftwebbrindes.com.br)

- Rota: `/categoria/dia-dos-pais` funciona automaticamente. `CategoryPage.tsx` detecta se o slug pertence a uma coleção; se sim, chama `search_products_by_collection` em vez de `search_products_by_category`. Clique no produto continua indo para o PDP normal (com variantes).
- Header (`src/components/Header.tsx` + menu mobile): adicionar item **"Dia dos Pais"** com destaque azul (cor primary/blue) ao lado dos atalhos "Garrafas / Copos / Mochilas / Kit Churrasco / Catálogo".
- Hero da página da coleção: título "Presentes para o **Dia dos Pais**" com "Dia dos Pais" em azul, subtítulo curto ("Selecionamos os brindes ideais…"), sem quebrar SEO da página de categoria (title/description próprios).

### 3. Catálogo B2B (/catalogo)

- Adicionar a coleção "Dia dos Pais" como opção na barra de categorias/stories (`CatalogHeroCategories` / `CatalogStoryCategories`) com badge/cor azul.
- Ao clicar, aplica filtro `?colecao=dia-dos-pais` e `CatalogPage` chama a mesma RPC de coleção. Demais filtros (cor, preço, busca) seguem funcionando.

### 4. Admin (edição futura, mínimo agora)

Não construir painel completo neste ciclo. Deixar o CRUD acessível apenas via SQL/migração. A estrutura já permite adicionar futuramente uma tela em `/admin` para gerenciar coleções e itens (fora do escopo desta entrega).

## Fora de escopo

- Painel admin visual para coleções (fica para depois, conforme escolhido)
- Alterações em preços, sync XBZ, PDP, orçamentos
- Novas categorias fixas ou remapeamento das existentes

## Detalhes técnicos

**Prefixos normalizados** (60): `9353, 9237, 9250, 9251, 9305, 19119, 19145, 2093, 9190, 9238, 9240, 9282, 9286, 9288, 19076, 19082, 01336, 9054, 19057, 1320, 3040, 3493, 4052, 4070, 5013, 7392, 7447, 8227, 12926, 18539, 18601, 18645L, KIT18639, 5036, 18623, 19022, 7020, 11870, 14046, 18673, 19013, 19039, 6040B, 10071G, 13474, 8124, 6093, 10385, 10889, 18894, 1495, 6757, 7032, 8130, 8298, 10124, 10127, 10390, 18599, 18895`.

`search_products_by_collection` reaproveita o CTE de `search_products_by_category`, trocando o filtro por:
```sql
WHERE upper(codigo_prefixo) IN (SELECT upper(codigo_prefixo) FROM product_collection_items WHERE collection_id = ...)
```

Destaque azul: usar token `--primary` (navy) ou nova var `--collection-blue: 217 91% 60%` para ficar vibrante sem quebrar o design system.

## Verificação

1. Acessar `/categoria/dia-dos-pais` → lista os produtos dos prefixos, com filtros funcionando.
2. Clicar em um produto → abre PDP com variantes normais.
3. Header desktop e mobile mostram "Dia dos Pais" em azul.
4. `/catalogo?colecao=dia-dos-pais` no B2B filtra corretamente e permite adicionar ao orçamento.
5. Produtos continuam aparecendo nas categorias originais (garrafas, kits etc.).
