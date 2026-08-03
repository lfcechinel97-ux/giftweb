# Itens mais vendidos: o que dá e o que não dá hoje

## Resposta curta
Pelo histórico da API da XBZ, **não**. A sincronização diária sobrescreve o campo de estoque de cada produto — não existe nenhuma tabela guardando o estoque de ontem, da semana passada ou de março. O log de sincronização (579 execuções desde 11/03/2026) grava só data, total de produtos e status, sem os números por item. Então não há como reconstruir retroativamente o que baixou de estoque.

Duas ressalvas importantes mesmo se houvesse histórico: o estoque da XBZ é do fornecedor, então a queda reflete as vendas de **todos** os clientes dela, não as suas; e reposições mascaram as saídas.

**O que existe de verdade hoje:** 308 orçamentos no sistema interno, cada um com os itens em detalhe. Essa é a fonte real do que a Gift Web vendeu/cotou.

## Proposta

### Parte 1 — Ranking real, a partir dos orçamentos (dado que já existe)
Nova página `/sistema/relatorios` mostrando:
- Ranking de produtos por quantidade e por faturamento, extraído dos itens dos orçamentos.
- Filtro por período (de/até) e por status (todos / só aprovados).
- Separação entre "cotado" (todos os orçamentos) e "vendido" (aprovados), para ver o que gera interesse mas não fecha.
- Ranking por cliente e por vendedor.
- Exportar CSV.

### Parte 2 — Começar a registrar o histórico de estoque (daqui pra frente)
- Nova tabela `estoque_historico` (produto, SKU, estoque, data), gravada a cada sincronização.
- Snapshot diário: um registro por produto por dia, sem apagar nada do que já existe.
- Nova aba na página de relatórios: "Demanda XBZ", mostrando os produtos com maior queda acumulada de estoque no período — um termômetro de demanda do mercado, marcado claramente como estimativa do fornecedor, não venda sua.
- Os primeiros números úteis aparecem depois de ~7 dias de coleta; a tendência fica sólida em ~30 dias.

## Detalhes técnicos
- Ranking dos orçamentos: função no banco que expande o JSONB `itens` de `sistema_orcamentos`, agrupando por SKU/nome, com filtros de período e status.
- Histórico: tabela nova com índice por (produto, data) e chave única por dia para não duplicar. A função de sincronização passa a inserir o snapshot ao final do processamento, dentro de um try/catch — se o snapshot falhar, a sincronização continua normal.
- A tabela nova é só de leitura para o admin autenticado (RLS + GRANT), escrita apenas pela função de sincronização.
- Nada é alterado em `products_cache`, no fluxo de sincronização existente, nos preços ou nos orçamentos.
