
## Plano — AdminProducts

### 1. Filtro de categoria (bug)
Hoje passamos uma lista de até ~900 UUIDs no `.in('id', ...)` — a URL estoura e a query devolve vazio (caso "Copos e Canecas").

**Correção:** mover a filtragem por categoria para dentro de uma RPC (ou fazer um inner join via view). Vou criar uma função SQL `admin_search_products(p_search, p_category_slug, p_status, p_page, p_page_size)` que faz `JOIN product_spotlight_categories` direto no servidor, com paginação e contagem em uma única chamada. O front passa apenas o slug.

Resultado: filtros de categoria voltam a funcionar para qualquer tamanho de catálogo, e fica mais rápido (1 round-trip em vez de 2).

### 2. Seleção em massa + ocultar/desocultar em lote
- Coluna `Checkbox` em cada linha + checkbox "selecionar todos" no cabeçalho da tabela.
- Estado `selectedIds: Set<string>`, limpo ao trocar página/filtros.
- Barra de ação flutuante (sticky) aparece quando há seleção: "X selecionados · [Ocultar] [Desocultar] [Limpar seleção]".
- Update em lote via `supabase.from('products_cache').update({ is_hidden }).in('id', [...selectedIds])`.

### 3. Itens por página (20 / 50 / 100)
- `Select` ao lado do contador "produtos encontrados". Default: 20.
- `pageSize` vira estado; resetar `page=0` ao mudar.
- Passado para a RPC do item 1.

### 4. Responsividade + ocultação imediata no site
- **Responsivo:** layout em grid hoje é fixo `60px_1fr_120px_100px_80px_120px`. No mobile vira card empilhado (foto à esquerda, infos + ações à direita) usando classes responsivas Tailwind.
- **Velocidade:** RPC do item 1 elimina o segundo round-trip; manter `useQuery` com `placeholderData: keepPreviousData` para evitar flicker entre páginas.
- **Ocultação imediata:** ao alternar `is_hidden`, fazer **optimistic update** no cache do React Query (`queryClient.setQueryData`) e invalidar as queries da home (`['homepage-data']`, etc.). Como o site público de outros visitantes só recarrega na próxima request, não há como forçar atualização em tempo real sem realtime — vou deixar uma nota no toast: "Oculto. O site público atualiza em até 1 min." (tempo do cache do navegador). Se quiser realtime de fato, precisamos habilitar Supabase Realtime na `products_cache` (faço junto).

### 5. Edição rápida de preço/markup direto na lista
Adicionar colunas inline editáveis na tabela (ao lado do nome, conforme pedido):

| Campo | Tipo | Pré-preenchido com |
|---|---|---|
| Preço de custo | input R$ | `preco_custo` atual |
| 20 un | multiplicador | `getMarkup(preco_custo)` (ex. 3.0x) |
| 50 un | multiplicador | `getMarkup * (1-0)` |
| 100 un | multiplicador | `getMarkup * (1-0.04)` |
| 200 un | multiplicador | `getMarkup * (1-0.07)` |
| 500 un | multiplicador | `getMarkup * (1-0.12)` |
| 1000+ un | multiplicador | `getMarkup * (1-0.16)` |

- Cada produto vira uma linha "expansível" com um botão "Preços" que abre uma sub-linha contendo: 1 input de preço de custo + 6 inputs pequenos de multiplicador. Botão "Salvar" persiste em `preco_custo` (numeric) e em `tabela_precos` (jsonb), no formato `[{qty, multiplicador}]`. Mantemos compat com o que já está em `AdminProductEdit` (que usa `desconto`); o sistema vai aceitar ambos os formatos na leitura, e a página de produto continua mostrando os valores corretos (`calcularPreco`).
- Dado que mostrar 7 inputs por linha em todos os 3700 produtos polui a tela, a sub-linha é colapsada por padrão e abre só quando o usuário clica em "Preços" (toggle por linha) — exatamente como você descreveu ("não ter que entrar produto por produto"), mas sem sobrecarregar visualmente.

### Resumo de arquivos
- **Nova migration:** função `admin_search_products(...)` (Postgres, SECURITY DEFINER, restrita a admin via `EXISTS admin_users`).
- **`src/pages/admin/AdminProducts.tsx`:** trocar `fetchProducts` para chamar a RPC; adicionar checkboxes + barra de seleção em massa; seletor de page size; layout responsivo; sub-linha de preços inline com salvamento.
- **`src/utils/price.ts`:** util para converter desconto↔multiplicador (compat com tabelas antigas).
- **`src/hooks/useHomepageData.ts`:** invalidação por React Query já vai disparar quando o admin alterar o cache; nada estrutural a mudar.

### Resultado esperado
- Filtro "Copos e Canecas" lista os 216 produtos pais.
- Ocultar/exibir em lote funciona.
- 20/50/100 por página.
- Tabela utilizável em mobile, paginação sem flicker, ocultar reflete no admin imediatamente e no site público no próximo fetch.
- Edição de preço de custo + multiplicadores por volume direto na lista, sem abrir o detalhe.
