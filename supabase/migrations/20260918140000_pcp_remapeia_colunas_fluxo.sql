-- =====================================================================
-- GIFT WEB - PCP: remapeia as colunas do Kanban pro fluxo completo que
-- o usuário descreveu (Aguardando Mercadoria -> Aguardando Teste ->
-- Teste Enviado -> A Produzir Galpão/Terceirizada -> Produzido ->
-- Expedição -> Coletado e Enviado).
--
-- REGRA SEGUIDA: nenhum status é apagado ou renomeado (slug intacto).
-- Só o campo coluna_pcp muda -- é ele que decide em qual coluna do
-- board cada status aparece. Conferido contra os dados reais antes de
-- escrever isto (nenhum pedido "sumiu" da contagem):
--
--   aguardando_mercadoria ........ 35  (sai de "pronto_producao")
--   imprimir_ordem_producao ...... 18  (fica em "pronto_producao")
--   aguardando_teste .............  3  (fica em "teste_fisico")
--   aguardando_aprovacao_teste ...  5  (sai de "teste_fisico" -> "teste_enviado")
--   a_produzir ....................  8  (fica em "em_producao", agora só galpão)
--   a_produzir_terceirizada .......  4  (sai de "em_producao" -> "em_producao_terceirizada")
--   conferir_pagamentos ...........  4  (sai de "embalagem_pagamento" -> "produzido")
--   enviar_etiqueta ...............  1  (sai de "embalagem_pagamento" -> "produzido")
--   organizando_anotacoes .........  6  (sem mudança)
--   aguardando_coleta .............  4  (sem mudança de coluna -- só rótulo vira "Expedição" no código)
--
-- "inserir_medidas" (0 itens hoje) segue o mesmo destino de
-- conferir_pagamentos/enviar_etiqueta, pra não deixar pra trás se
-- algum dia for usado de novo.
-- =====================================================================

-- 0) A tabela tinha um CHECK CONSTRAINT travando coluna_pcp nas 8
--    colunas antigas -- é o que fez a primeira tentativa desta
--    migration falhar inteira (23514, nenhuma linha mudou). Solta o
--    constraint antigo e recria com o conjunto novo de colunas (as 8
--    antigas continuam válidas, pra não quebrar nada que já usa;
--    "embalagem_pagamento" também fica na lista só por segurança --
--    não é mais alvo de nenhum status, mas remover do check agora não
--    ajuda em nada e um dia pode existir dado velho apontando pra lá).
alter table public.sistema_status drop constraint if exists sistema_status_coluna_pcp_check;
alter table public.sistema_status add constraint sistema_status_coluna_pcp_check
  check (coluna_pcp in (
    'organizando_pedido', 'pronto_producao', 'aguardando_mercadoria',
    'teste_fisico', 'teste_enviado', 'preparacao',
    'em_producao', 'em_producao_terceirizada', 'produzido',
    'embalagem_pagamento', 'aguardando_coleta', 'enviado', 'cancelado'));

-- 1) Novo status "Produzido" -- não existia; é o elo que faltava entre
--    "acabou de produzir" e "expedição" (que já tem o popup de volumes
--    e pagamento pronto desde a fase anterior do PCP).
insert into public.sistema_status (slug, nome, cor, ordem, coluna_pcp, escopo, protegido)
values ('produzido', 'Produzido', '#22C55E', 75, 'produzido', 'ambos', false)
on conflict (slug) do nothing;

-- 2) Aguardando Mercadoria ganha coluna própria (antes dividia
--    "pronto_producao" com Imprimir Ordem de Produção).
update public.sistema_status set coluna_pcp = 'aguardando_mercadoria'
  where slug = 'aguardando_mercadoria';

-- 3) Teste Enviado (aguardando aprovação do cliente) sai da coluna de
--    Teste Físico e ganha a própria -- fica visualmente claro quem
--    ainda não tem teste feito vs. quem já mandou e está esperando
--    resposta do cliente.
update public.sistema_status set coluna_pcp = 'teste_enviado'
  where slug = 'aguardando_aprovacao_teste';

-- 4) A Produzir — Terceirizada sai da coluna "Em Produção" (que
--    dividia com o galpão) e ganha a própria.
update public.sistema_status set coluna_pcp = 'em_producao_terceirizada'
  where slug = 'a_produzir_terceirizada';

-- 5) Os 3 status de "Embalagem & Pagamento" (coluna que o novo fluxo
--    não usa mais -- pagamento agora é perguntado no popup de
--    Expedição) migram pra "Produzido": é o destino mais correto pra
--    quem já produziu e só faltava embalar/conferir antes de expedir.
update public.sistema_status set coluna_pcp = 'produzido'
  where slug in ('inserir_medidas', 'conferir_pagamentos', 'enviar_etiqueta');
