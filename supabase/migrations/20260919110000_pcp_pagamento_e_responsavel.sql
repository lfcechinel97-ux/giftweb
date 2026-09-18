-- =====================================================================
-- GIFT WEB - Novos campos do pedido pro fluxo de 7 colunas:
--   - comprovante_pagamento_url: popup obrigatório ao sair de
--     "Organizando Anotações" -> "Aguardando Mercadoria" (comprovante
--     anexado ou confirmação manual "CONFIRMADO MARLON", que grava o
--     texto fixo 'confirmado-manualmente' aqui).
--   - volumes_responsavel: nome de quem mediu/embalou, junto do popup
--     de volumes da Expedição (sistema_pedidos.volumes já existe).
-- =====================================================================

alter table public.sistema_pedidos
  add column if not exists comprovante_pagamento_url text,
  add column if not exists volumes_responsavel text;

drop view if exists public.vw_pcp;
create view public.vw_pcp as
select
  pi.id as producao_id,
  p.id as pedido_id,
  p.numero as pedido_numero,
  public.sistema_cor_pedido(p.numero) as pedido_cor,
  p.vendedor_id as pedido_vendedor_id,
  c.nome as cliente,
  it.item ->> 'nome'          as produto_nome,
  it.item ->> 'mockupImagem'  as mockup_url,
  it.item ->> 'imagem'        as imagem_catalogo_url,
  it.item ->> 'arteAnexoUrl'  as arte_anexo_url,
  (it.item ->> 'quantidade')::numeric    as quantidade,
  (it.item ->> 'precoUnitario')::numeric as valor_unitario,
  it.item ->> 'observacao'    as item_observacao,
  pi.status,
  s.nome       as status_nome,
  s.cor        as status_cor,
  s.coluna_pcp as coluna_pcp,
  pi.local_producao,
  pi.origem_estoque,
  pi.data_entrega_item,
  pi.tecnica_id,
  t.nome as tecnica_nome,
  pi.terceirizada_id,
  f.nome as terceirizada_nome,
  f.telefone as terceirizada_telefone,
  pi.terceirizada_nome_livre,
  pi.enviado_terceiro_em,
  pi.previsao_retorno,
  pi.qtd_enviada,
  pi.qtd_retornada,
  pi.compra_confirmada_em,
  pi.fornecedor_compra_id,
  pi.medidas_ok,
  pi.pagamento_ok,
  pi.etiqueta_ok,
  pi.coleta_solicitada_em,
  pi.pagamento_cartao_conferido_em,
  pi.pix_recebido_integral_em,
  pi.teste_anexo_url,
  pi.teste_enviado_em,
  pi.producao_anexo_url,
  pi.producao_anexo_tipo,
  pi.producao_anexo_em,
  pi.tags,
  pi.created_at as item_criado_em,
  mp.nome as pagamento_nome,
  p.total as pedido_total,
  p.observacoes as pedido_observacoes,
  p.volumes as pedido_volumes,
  p.volumes_responsavel as pedido_volumes_responsavel,
  p.pago_integral as pedido_pago_integral,
  p.comprovante_pagamento_url as pedido_comprovante_pagamento_url,
  p.anexos as pedido_anexos,
  h.ultima_mudanca as etapa_desde,
  extract(epoch from (now() - h.ultima_mudanca)) / 3600::numeric as horas_na_etapa,
  (select count(*) from public.sistema_producao_itens x
    where x.pedido_id = p.id) as total_itens_pedido,
  (select count(*) from public.sistema_producao_itens x
     join public.sistema_status sx on sx.slug = x.status
    where x.pedido_id = p.id and sx.coluna_pcp = 'enviado') as itens_enviados_pedido,
  (select count(*) from public.sistema_producao_itens x
     join public.sistema_status sx on sx.slug = x.status
    where x.pedido_id = p.id and sx.coluna_pcp = 'aguardando_coleta') as itens_expedicao_pedido
from public.sistema_producao_itens pi
join public.sistema_pedidos p on p.id = pi.pedido_id
join public.sistema_status s on s.slug = pi.status
left join public.sistema_clientes c on c.id = p.cliente_id
left join public.sistema_tecnicas t on t.id = pi.tecnica_id
left join public.sistema_fornecedores f on f.id = pi.terceirizada_id
left join public.sistema_meios_pagamento mp on mp.id = p.pagamento_id
cross join lateral (
  select e.value as item
  from jsonb_array_elements(p.itens) e
  where (e.value ->> 'id')::uuid = pi.item_id
  limit 1
) it
left join lateral (
  select coalesce(
    (select hh.created_at from public.sistema_producao_historico hh
      where hh.producao_item_id = pi.id
      order by hh.created_at desc limit 1),
    pi.created_at) as ultima_mudanca
) h on true
where s.coluna_pcp <> 'cancelado'
  and p.status <> 'cancelado';

grant select on public.vw_pcp to authenticated;
