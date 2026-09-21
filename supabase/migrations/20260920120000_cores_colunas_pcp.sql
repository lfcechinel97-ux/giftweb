-- =====================================================================
-- GIFT WEB - Escurece as cores de coluna/status que ficavam claras
-- demais para o texto branco em negrito do cabeçalho do PCP.
-- Só a cor muda: nenhum status renomeado, apagado ou remapeado.
-- =====================================================================

update public.sistema_status set cor = '#7E22CE' where slug = 'aguardando_teste'        and cor = '#9E42F6';
update public.sistema_status set cor = '#A21CAF' where slug = 'aguardando_aprovacao_teste' and cor = '#C026D3';
update public.sistema_status set cor = '#1D4ED8' where slug = 'a_produzir'              and cor = '#2563EB';
update public.sistema_status set cor = '#15803D' where slug = 'produzido'               and cor = '#22C55E';
