-- =====================================================================
-- GIFT WEB - Badge de status vira preenchimento SOLIDO + texto branco
-- (antes: fundo suave + texto escuro). 9 das 15 cores do catalogo nao
-- tinham contraste suficiente (4.5:1) para texto branco em cima -- essa
-- migration so escurece o necessario para cada uma passar, mantendo a
-- matiz original (nao e uma repaleta, e um ajuste de luminosidade).
--
-- Contraste medido (branco sobre a cor), antes -> depois:
--   imprimir_ordem_producao  #0EA5E9 (2.77) -> #0B7CAF (4.65)
--   aguardando_mercadoria    #F59E0B (2.15) -> #A36907 (4.58)
--   aguardando_teste         #A855F7 (3.96) -> #9E42F6 (4.60)
--   preparar_dtf             #8B5CF6 (4.23) -> #8452F5 (4.66)
--   inserir_medidas          #0D9488 (3.74) -> #0B8177 (4.75)
--   conferir_pagamentos      #059669 (3.77) -> #05875F (4.53)
--   enviar_etiqueta          #16A34A (3.30) -> #12883E (4.55)
--   aguardando_coleta        #CA8A04 (2.94) -> #9D6B03 (4.63)
--
-- As outras 7 cores ja passavam (>=4.71) e ficam como estao.
-- =====================================================================

update public.sistema_status set cor = '#0B7CAF' where slug = 'imprimir_ordem_producao';
update public.sistema_status set cor = '#A36907' where slug = 'aguardando_mercadoria';
update public.sistema_status set cor = '#9E42F6' where slug = 'aguardando_teste';
update public.sistema_status set cor = '#8452F5' where slug = 'preparar_dtf';
update public.sistema_status set cor = '#0B8177' where slug = 'inserir_medidas';
update public.sistema_status set cor = '#05875F' where slug = 'conferir_pagamentos';
update public.sistema_status set cor = '#12883E' where slug = 'enviar_etiqueta';
update public.sistema_status set cor = '#9D6B03' where slug = 'aguardando_coleta';
