ALTER TABLE public.sistema_producao_itens
  ADD COLUMN IF NOT EXISTS pagamento_cartao_conferido_em timestamptz,
  ADD COLUMN IF NOT EXISTS pix_recebido_integral_em timestamptz;

DROP VIEW IF EXISTS public.vw_pcp;

CREATE VIEW public.vw_pcp AS
SELECT pi.id AS producao_id,
    p.id AS pedido_id,
    p.numero AS pedido_numero,
    sistema_cor_pedido(p.numero) AS pedido_cor,
    c.nome AS cliente,
    item.value ->> 'nome'::text AS produto_nome,
    item.value ->> 'mockupImagem'::text AS mockup_url,
    item.value ->> 'imagem'::text AS imagem_catalogo_url,
    (item.value ->> 'quantidade'::text)::numeric AS quantidade,
    (item.value ->> 'precoUnitario'::text)::numeric AS valor_unitario,
    pi.status,
    pi.local_producao,
    pi.origem_estoque,
    pi.data_entrega_item,
    pi.tecnica_id,
    t.nome AS tecnica_nome,
    pi.terceirizada_id,
    f.nome AS terceirizada_nome,
    f.telefone AS terceirizada_telefone,
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
    mp.nome AS pagamento_nome,
    p.total AS pedido_total,
    COALESCE(( SELECT h.created_at
           FROM sistema_producao_historico h
          WHERE h.producao_item_id = pi.id
          ORDER BY h.created_at DESC
         LIMIT 1), pi.created_at) AS etapa_desde,
    EXTRACT(epoch FROM now() - COALESCE(( SELECT h.created_at
           FROM sistema_producao_historico h
          WHERE h.producao_item_id = pi.id
          ORDER BY h.created_at DESC
         LIMIT 1), pi.created_at)) / 3600::numeric AS horas_na_etapa,
    ( SELECT count(*) AS count
           FROM sistema_producao_itens x
          WHERE x.pedido_id = p.id) AS total_itens_pedido,
    ( SELECT count(*) AS count
           FROM sistema_producao_itens x
          WHERE x.pedido_id = p.id AND x.status = 'enviado'::text) AS itens_enviados_pedido
   FROM sistema_producao_itens pi
     JOIN sistema_pedidos p ON p.id = pi.pedido_id
     LEFT JOIN sistema_clientes c ON c.id = p.cliente_id
     LEFT JOIN sistema_tecnicas t ON t.id = pi.tecnica_id
     LEFT JOIN sistema_fornecedores f ON f.id = pi.terceirizada_id
     LEFT JOIN sistema_meios_pagamento mp ON mp.id = p.pagamento_id
     CROSS JOIN LATERAL jsonb_array_elements(p.itens) item(value)
  WHERE ((item.value ->> 'id'::text)::uuid) = pi.item_id AND pi.status <> 'cancelado'::text;

GRANT SELECT ON public.vw_pcp TO authenticated;
GRANT ALL ON public.vw_pcp TO service_role;