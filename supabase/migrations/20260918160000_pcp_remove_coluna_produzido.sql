-- =====================================================================
-- GIFT WEB - Remove a coluna "Produzido" do board (feedback do
-- usuário: não fazia sentido como etapa própria).
--
-- Os 4 status que apontavam pra coluna_pcp='produzido' (produzido,
-- inserir_medidas, conferir_pagamentos, enviar_etiqueta) passam a
-- apontar pra 'aguardando_coleta' -- fica dentro de "Expedição" em vez
-- de uma parada extra no meio. Nenhum status é apagado.
-- =====================================================================

update public.sistema_status set coluna_pcp = 'aguardando_coleta'
  where slug in ('produzido', 'inserir_medidas', 'conferir_pagamentos', 'enviar_etiqueta');
