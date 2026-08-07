# Diagnóstico e plano de performance do /sistema

## O que eu consegui confirmar agora

Tentei consultar o banco várias vezes durante esta análise — inclusive uma consulta trivial (`select 1`) — e **todas falharam por tempo esgotado de conexão**. As métricas de saúde do banco também não responderam. A infraestrutura da Lovable Cloud em si está no ar.

Isso significa que o banco não está apenas lento: em alguns momentos ele **não aceita novas conexões**. É exatamente o sintoma que você descreve — "às vezes demora, às vezes nem carrega".

A instância atual do backend é de tamanho **Tiny** (a menor). Um Tiny tem pouquíssimas conexões simultâneas e pouca memória; com o sistema interno abrindo várias consultas pesadas em paralelo por tela, o limite estoura e as requisições ficam presas até dar timeout.

O que ainda **não** consegui confirmar (porque o banco não respondeu): quais consultas específicas são as mais lentas e se faltam índices. Isso é o primeiro passo do plano.

## Problemas de aplicação que eu já vi no código

Independente do banco, o sistema puxa dados demais de uma vez:

1. **Carga inicial gigante** — ao entrar em qualquer tela do /sistema, o app dispara em paralelo: bootstrap, todos os clientes, **300 orçamentos**, e logo em seguida **500 pedidos** e **1000 ajustes de estoque**. Tudo sem paginação real e tudo antes de a tela poder ser usada.
2. **Orçamentos e pedidos duplicam trabalho** — a lista já vem do contexto global e depois cada tela busca de novo os itens em lote.
3. **Produtos** — a tela de produtos chama a RPC de busca a cada digitação (com debounce de 250ms) e a listagem inicial traz 80 produtos com muitas colunas, incluindo campos JSON grandes (`variantes`, `tabela_precos`, `image_urls`) que nem são usados na lista.
4. **Sem cache compartilhado** — o contexto do sistema não usa TanStack Query, então sai do ar do cache assim que o provider remonta.

## Plano

### Etapa 1 — Destravar o banco (prioridade)
- Aumentar o tamanho da instância da Lovable Cloud (de Tiny para um porte maior). Posso fazer isso pelo chat, com uma tela de aprovação sua. Isso resolve a saturação de conexões que hoje causa as telas que "não carregam".
- Com o banco respondendo, rodar a análise de consultas lentas e `EXPLAIN` nas RPCs `sistema_list_orcamentos`, `sistema_get_bootstrap`, `sistema_search_products` e na view `vw_pcp`.
- Criar os índices faltantes que a análise apontar (ex.: busca por texto em `products_cache`, filtros por vendedor/status/data em `sistema_orcamentos`, `created_at` em `sistema_pedidos`).

### Etapa 2 — Reduzir o volume de dados por tela
- Trocar a carga de 300 orçamentos / 500 pedidos / 1000 ajustes por **paginação real no servidor** (25 por página), com contagem total separada.
- Carregar ajustes de estoque só quando a tela de Estoque for aberta.
- Nas RPCs de listagem, devolver só as colunas que a lista mostra (sem JSONs pesados); os detalhes vêm ao abrir o registro.
- Na tela de Produtos, enxugar as colunas selecionadas e aumentar o debounce da busca.

### Etapa 3 — Cache e resiliência
- Migrar as leituras do `SistemaContext` para TanStack Query (`staleTime` 60s), para navegação entre telas ficar instantânea sem refazer as consultas.
- Adicionar timeout + 1 nova tentativa automática nas consultas, com mensagem clara em vez de tela parada em "Carregando...".
- Prefetch no hover do menu lateral (já existe para algumas rotas — estender para Orçamentos, Pedidos e Produtos).

### O que NÃO muda
Nenhuma alteração de layout, de regra de negócio, de preço ou de fluxo. É trabalho exclusivamente de performance.

## Detalhes técnicos
- Arquivos envolvidos: `src/contexts/SistemaContext.tsx`, `src/pages/sistema/Orcamentos.tsx`, `src/pages/sistema/Pedidos.tsx`, `src/pages/sistema/ProdutosCatalogo.tsx`, `src/pages/sistema/useSistemaProducts.ts`, `src/pages/sistema/SistemaLayout.tsx`.
- Banco: novos índices via migration; ajuste das RPCs de listagem para paginação server-side com `total_count`.
- Redimensionamento da instância leva alguns minutos e pode impactar o consumo do plano.
