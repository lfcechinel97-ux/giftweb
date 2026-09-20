-- =====================================================================
-- GIFT WEB - Coluna "Inserir Medidas" no PCP, entre "A Produzir" e
-- "Expedição". A foto/vídeo do produto pronto sai antes de a caixa ser
-- fechada e medida; o item espera aqui até a produção lançar os volumes.
-- Nenhum status apagado/renomeado: só coluna_pcp remapeado.
-- =====================================================================

alter table public.sistema_status drop constraint if exists sistema_status_coluna_pcp_check;
alter table public.sistema_status add constraint sistema_status_coluna_pcp_check
  check (coluna_pcp in (
    'organizando_pedido', 'organizando_comercial', 'pronto_producao', 'aguardando_mercadoria',
    'teste_fisico', 'teste_enviado', 'preparacao',
    'em_producao', 'em_producao_terceirizada', 'produzido', 'inserir_medidas',
    'embalagem_pagamento', 'aguardando_coleta', 'enviado', 'cancelado'));

update public.sistema_status set coluna_pcp = 'inserir_medidas'
  where slug in ('inserir_medidas', 'produzido');

-- Atualização automática para todos os usuários: garante que as tabelas
-- do PCP/Pedidos estão na publicação do realtime (idempotente).
alter table public.sistema_producao_itens     replica identity full;
alter table public.sistema_producao_historico replica identity full;
alter table public.sistema_pedidos            replica identity full;

do $$
declare t text;
begin
  foreach t in array array[
    'sistema_producao_itens',
    'sistema_producao_historico',
    'sistema_pedidos',
    'sistema_producao_anexos'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
      when undefined_table then null;
    end;
  end loop;
end $$;
