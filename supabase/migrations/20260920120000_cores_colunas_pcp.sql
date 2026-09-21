-- =====================================================================
-- GIFT WEB - Paleta das colunas/status do PCP: só variações das cores
-- primárias (azul, verde, vermelho, roxo, laranja), todas fechadas o
-- bastante para o texto branco em negrito do cabeçalho e das etiquetas.
-- Sai o marrom/mostarda. Só a cor muda: nenhum status renomeado,
-- apagado ou remapeado.
-- =====================================================================

update public.sistema_status set cor = case slug
  when 'organizando_anotacoes'       then '#075985'  -- azul escuro
  when 'imprimir_ordem_producao'     then '#0369A1'  -- azul
  when 'aguardando_mercadoria'       then '#C2410C'  -- laranja
  when 'aguardando_teste'            then '#7E22CE'  -- roxo
  when 'aguardando_aprovacao_teste'  then '#A21CAF'  -- roxo/magenta
  when 'preparar_dtf'                then '#6D28D9'  -- roxo
  when 'a_produzir'                  then '#1D4ED8'  -- azul
  when 'a_produzir_terceirizada'     then '#1E40AF'  -- azul escuro
  when 'produzido'                   then '#15803D'  -- verde
  when 'inserir_medidas'             then '#047857'  -- verde escuro
  when 'conferir_pagamentos'         then '#047857'
  when 'enviar_etiqueta'             then '#B91C1C'  -- vermelho
  when 'aguardando_coleta'           then '#B91C1C'
  when 'coletado_enviado'            then '#15803D'
  when 'entregue'                    then '#166534'
  when 'cancelado'                   then '#DC2626'
  else cor
end
where slug in (
  'organizando_anotacoes', 'imprimir_ordem_producao', 'aguardando_mercadoria',
  'aguardando_teste', 'aguardando_aprovacao_teste', 'preparar_dtf',
  'a_produzir', 'a_produzir_terceirizada', 'produzido', 'inserir_medidas',
  'conferir_pagamentos', 'enviar_etiqueta', 'aguardando_coleta',
  'coletado_enviado', 'entregue', 'cancelado');
