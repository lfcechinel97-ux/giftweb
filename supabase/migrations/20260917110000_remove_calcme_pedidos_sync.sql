-- =====================================================================
-- GIFT WEB - Remove o mecanismo de SINCRONIZACAO automatica de pedidos
-- com o Calcme. Os pedidos passam a nascer direto no sistema (ou, no caso
-- do lote historico, reimportados uma vez a partir da planilha + fotos —
-- ver scratchpad da sessao de 17/09/2026).
--
-- O que NAO e tocado aqui, de proposito:
--   - sync-calcme-financeiro / sistema_calcme_vendas: integracao SEPARADA
--     que alimenta o dashboard financeiro com 284+ linhas de receita real.
--     Nao tem relacao com o fluxo de pedidos/PCP.
--   - sistema_calcme_itens / sistema_calcme_item_arquivos: a tabela em si
--     fica (facil de studar depois se algum pedido antigo precisar de
--     auditoria), so nao recebe mais gravacao automatica.
-- =====================================================================

-- O log da sincronizacao de PEDIDOS nao tem mais quem escreva nele (a
-- edge function sync-calcme-orders foi removida do repo). Os dados ja
-- foram truncados manualmente durante a reimportacao; isto so garante
-- que o schema documente a decisao.
comment on table public.sistema_calcme_sync_log is
  'Historico da sincronizacao automatica de pedidos com o Calcme — mecanismo REMOVIDO em 17/09/2026. Pedidos agora nascem direto no sistema. Tabela mantida so como registro historico de quando a sincronizacao existiu.';
