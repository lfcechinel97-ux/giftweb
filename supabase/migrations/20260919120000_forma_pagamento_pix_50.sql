-- =====================================================================
-- GIFT WEB - Forma de pagamento "PIX 50% Pedido + 50% Pronto".
--
-- O PCP detecta essa condição pelo texto do nome (contém "50") pra
-- decidir a tag automática na Expedição (COBRAR 50% RESTANTE) -- sem
-- essa opção cadastrada, o vendedor não tinha como selecionar.
-- =====================================================================

insert into public.sistema_meios_pagamento (nome, ativo)
select 'PIX 50% Pedido + 50% Pronto', true
where not exists (
  select 1 from public.sistema_meios_pagamento where nome = 'PIX 50% Pedido + 50% Pronto'
);
