-- =====================================================================
-- GIFT WEB - Migration 09
-- Ajusta sistema_producao_itens pro fluxo real de 8 colunas (era 9
-- genericas, agora reflete o processo real do galpao), adiciona
-- checklist de embalagem/pagamento/etiqueta, e cor por pedido pra
-- agrupar visualmente itens do mesmo pedido espalhados em colunas
-- diferentes no Kanban.
--
-- Rodar DEPOIS do 08_fix_producao_satelite.sql.
-- =====================================================================

-- 1) Trocar os valores possiveis de status (era check constraint, nao
--    enum de verdade — mais facil de alterar, sem dor de ALTER TYPE)
alter table sistema_producao_itens drop constraint if exists sistema_producao_itens_status_check;

-- migra os valores antigos pros novos antes de travar o constraint novo
update sistema_producao_itens set status = case status
  when 'aguardando_arte'    then 'organizando_pedido'
  when 'aguardando_compra'  then 'pronto_producao'
  when 'fila_producao'      then 'pronto_producao'
  when 'em_producao'        then 'em_producao'
  when 'enviado_terceiro'   then 'preparacao'
  when 'retornou_terceiro'  then 'embalagem_pagamento'
  when 'conferencia'        then 'embalagem_pagamento'
  when 'pronto'             then 'aguardando_coleta'
  when 'expedido'           then 'enviado'
  else status
end;

alter table sistema_producao_itens add constraint sistema_producao_itens_status_check
  check (status in (
    'organizando_pedido',   -- vendedor lançando/ajustando o pedido
    'pronto_producao',      -- ordem impressa; badge separado indica se falta mercadoria
    'teste_fisico',         -- aguardando aprovação do cliente na amostra física
    'preparacao',           -- vetorização / envio pra terceirizada
    'em_producao',          -- rodando (badge indica interna ou terceirizada)
    'embalagem_pagamento',  -- medidas + pagamento + etiqueta (checklist)
    'aguardando_coleta',    -- esperando transportadora / ponto de coleta
    'enviado',              -- coletado e enviado
    'cancelado'
  ));

alter table sistema_producao_itens alter column status set default 'organizando_pedido';

-- 2) Checklist de embalagem — 3 caixinhas dentro do mesmo card
alter table sistema_producao_itens add column if not exists medidas_ok boolean not null default false;
alter table sistema_producao_itens add column if not exists pagamento_ok boolean not null default false;
alter table sistema_producao_itens add column if not exists etiqueta_ok boolean not null default false;

-- 3) Lembrete de coleta — pra nao esquecer de chamar a transportadora
alter table sistema_producao_itens add column if not exists coleta_solicitada_em timestamptz;

-- 4) Cor por pedido — pra agrupar visualmente itens do mesmo pedido
--    espalhados em colunas diferentes. Gerada de forma deterministica
--    a partir do numero do pedido, nao precisa guardar nada extra:
create or replace function public.sistema_cor_pedido(p_numero text)
returns text language sql immutable as $$
  select ('#' || substr(md5(p_numero), 1, 6))
$$;
-- uso no front: sistema_cor_pedido(pedido_numero) via RPC, ou calcular
-- a mesma logica (md5 hex das 6 primeiras posicoes) direto em JS.

-- 5) VIEW vw_pcp atualizada — adiciona tempo na etapa atual e progresso
--    do pedido (quantos itens prontos de quantos no total)
create or replace view vw_pcp as
select
  pi.id as producao_id,
  p.id as pedido_id,
  p.numero as pedido_numero,
  sistema_cor_pedido(p.numero) as pedido_cor,
  c.nome as cliente,
  item->>'nome' as produto_nome,
  item->>'mockupImagem' as mockup_url,
  item->>'imagem' as imagem_catalogo_url,
  (item->>'quantidade')::numeric as quantidade,
  (item->>'precoUnitario')::numeric as valor_unitario,
  pi.status, pi.local_producao, pi.origem_estoque,
  pi.data_entrega_item, pi.tecnica_id, t.nome as tecnica_nome,
  pi.terceirizada_id, f.nome as terceirizada_nome, f.telefone as terceirizada_telefone,
  pi.enviado_terceiro_em, pi.previsao_retorno, pi.qtd_enviada, pi.qtd_retornada,
  pi.compra_confirmada_em, pi.fornecedor_compra_id,
  pi.medidas_ok, pi.pagamento_ok, pi.etiqueta_ok, pi.coleta_solicitada_em,
  -- tempo desde a ultima mudanca de status (ou desde a criacao, se nunca mudou)
  coalesce(
    (select h.created_at from sistema_producao_historico h
      where h.producao_item_id = pi.id order by h.created_at desc limit 1),
    pi.created_at
  ) as etapa_desde,
  extract(epoch from (now() - coalesce(
    (select h.created_at from sistema_producao_historico h
      where h.producao_item_id = pi.id order by h.created_at desc limit 1),
    pi.created_at
  ))) / 3600 as horas_na_etapa,
  -- progresso do pedido: quantos itens ja passaram de "enviado", de quantos no total
  (select count(*) from sistema_producao_itens x where x.pedido_id = p.id) as total_itens_pedido,
  (select count(*) from sistema_producao_itens x where x.pedido_id = p.id and x.status = 'enviado') as itens_enviados_pedido
from sistema_producao_itens pi
join sistema_pedidos p on p.id = pi.pedido_id
left join sistema_clientes c on c.id = p.cliente_id
left join sistema_tecnicas t on t.id = pi.tecnica_id
left join sistema_fornecedores f on f.id = pi.terceirizada_id
cross join lateral jsonb_array_elements(p.itens) as item
where (item->>'id')::uuid = pi.item_id
  and pi.status <> 'cancelado';

-- limite de horas por coluna antes de virar alerta visual (usar no front)
-- organizando_pedido: 24h | pronto_producao: 48h | teste_fisico: 72h
-- preparacao: 24h | em_producao: 48h | embalagem_pagamento: 24h
-- aguardando_coleta: 12h | enviado: sem limite

-- =====================================================================
-- CONFERENCIA
-- =====================================================================
-- select pedido_numero, produto_nome, status, round(horas_na_etapa,1) hrs,
--        itens_enviados_pedido || '/' || total_itens_pedido as progresso
--   from vw_pcp order by horas_na_etapa desc limit 20;
