-- =====================================================================
-- GIFT WEB - PCP: simplifica pra 7 colunas (pedido explícito do
-- usuário -- "antes eram 15", quer só: Organizando Anotações,
-- Aguardando Mercadoria, Aguardando Teste, Teste Enviado, A Produzir,
-- Expedição, Coletado e Enviado).
--
-- Nenhum status é apagado -- só coluna_pcp muda:
--   imprimir_ordem_producao:  pronto_producao        -> organizando_pedido
--   preparar_dtf:              preparacao              -> em_producao
--   a_produzir_terceirizada:   em_producao_terceirizada -> em_producao
-- (aguardando_mercadoria, teste_fisico/teste_enviado, aguardando_coleta,
--  enviado já estavam corretos das migrations anteriores.)
-- =====================================================================

update public.sistema_status set coluna_pcp = 'organizando_pedido'
  where slug = 'imprimir_ordem_producao';

update public.sistema_status set coluna_pcp = 'em_producao'
  where slug in ('preparar_dtf', 'a_produzir_terceirizada');
