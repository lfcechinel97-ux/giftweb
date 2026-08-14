# Etapa 1 — Cortar carga desnecessária no /sistema

## O que eu confirmei no código agora

- **Prefetch de dados no hover existe** (`SistemaLayout.tsx`): passar o mouse em "PCP" busca a view `vw_pcp` inteira e em "Pedidos" busca todos os registros de `sistema_producao_itens`. O prefetch do chunk de código também está lá (esse é leve e fica).
- **Carga inicial** (`SistemaContext.tsx`, função `loadAll`): dispara em paralelo bootstrap + **todos os clientes** + **300 orçamentos**; logo em seguida, em segundo plano, **500 pedidos** + **1000 ajustes de estoque**. Tudo isso ao abrir qualquer tela do /sistema, inclusive Configurações.
- **Paginação de orçamentos é só de exibição**, não do servidor. A tela busca 300 registros e faz `filtered.slice(...)` para mostrar 10 (`Orcamentos.tsx`, linha 298). Ou seja: sua suspeita do item 3 está correta — hoje a query traz 300.

## O que vou fazer

### 1. Prefetch de dados removido
Tirar as duas `prefetchQuery` do hover do menu. Fica só `item.chunk()`, o import dinâmico da rota.

### 2. Carga inicial mínima
- `loadAll` passa a buscar **apenas o bootstrap** (vendedores, meios de pagamento, transportadoras, origens) — é o que a barra superior e os formulários precisam sempre.
- **Clientes**, **pedidos** e **ajustes de estoque** passam a ter carregadores sob demanda (`ensureClientes()`, `ensurePedidos()`, `ensureAjustes()`), chamados pela tela que os usa (Clientes, Pedidos/PCP, Estoque) e por quem depende deles (o formulário de orçamento precisa de clientes).
- Cada carregador roda uma vez por sessão e não repete enquanto os dados estiverem em memória.
- Aprovação de orçamento continua funcionando: ela já busca o orçamento completo antes de gerar o pedido, e vai garantir clientes/ajustes carregados antes de gravar.

### 3. Paginação de orçamentos no servidor
- A lista passa a buscar **só a página atual** (10 por padrão, respeitando o seletor 10/25/50/100), usando a RPC `sistema_list_orcamentos`, que já aceita filtros de vendedor, status, busca e cliente, e já devolve `total_count`.
- Filtros e busca vão para o servidor (é assim que a RPC já funciona), então continuam valendo sobre o conjunto completo, não só sobre a página visível.
- O contador do topo passa a usar o `total_count` da RPC.
- Os itens dos orçamentos continuam vindo na requisição em lote já existente — agora para 10 registros em vez de 300.

## Medição que vou te entregar ao final
Número de requisições ao banco ao abrir `/sistema/orcamentos`, antes e depois, e quantas linhas cada uma traz.

## O que NÃO muda
Nenhuma alteração de layout, de regra de negócio, de preço, de numeração ou de fluxo de aprovação. Nada de service worker, PWA, nem upgrade de instância.

## Detalhes técnicos
- `src/pages/sistema/SistemaLayout.tsx` — remover `prefetchQuery`, manter `chunk()`.
- `src/contexts/SistemaContext.tsx` — enxugar `loadAll`; adicionar `ensureClientes/ensurePedidos/ensureAjustes` com guarda de "já carregado"/"em andamento"; expor no contexto.
- `src/pages/sistema/Orcamentos.tsx` — trocar `slice` local por consulta paginada via RPC (`p_page`/`p_page_size` já existem na assinatura? se não, a paginação será feita com `range()` sobre `sistema_orcamentos` + `count: 'exact'`, sem migration).
- `src/pages/sistema/Clientes.tsx`, `Pedidos.tsx`, `PCP.tsx`, `Estoque.tsx`, `OrcamentoForm.tsx` — chamar o `ensure*` correspondente na montagem.
- Sem migration nesta etapa.
