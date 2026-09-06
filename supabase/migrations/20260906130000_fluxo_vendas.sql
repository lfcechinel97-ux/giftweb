-- =====================================================================
-- FLUXO DE VENDAS — conferência do pedido antes de virar número no DRE
--
-- É a planilha "Fechamento Produtos" virando tela: para cada pedido você
-- confere meio de pagamento, imposto, comissão e o custo de cada item, e
-- o lucro cai no dashboard.
--
-- A taxa de cartão passa a nascer do MEIO DE PAGAMENTO. Na sua planilha
-- ela varia (3,66% / 4,58% / 5,47% / 6,36% / 7,25%) conforme a forma —
-- guardar a taxa junto da forma evita redigitar em todo pedido.
--
-- Cascata final do percentual, do mais específico ao mais geral:
--   item → pedido → meio de pagamento → sistema_financeiro_config
--
-- Aditiva: não remove nem renomeia coluna nenhuma.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Taxa por meio de pagamento
-- ---------------------------------------------------------------------
ALTER TABLE public.sistema_meios_pagamento
  ADD COLUMN IF NOT EXISTS taxa_pct numeric(6,3) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.sistema_meios_pagamento.taxa_pct IS
  'Percentual descontado da venda por esta forma de pagamento (taxa de maquininha). Pix/boleto/dinheiro = 0.';

-- Formas usuais, só se ainda não houver nenhuma cadastrada — não mexe no
-- que você já tem. As taxas de cartão são as que aparecem na sua planilha
-- de fechamento; o número de parcelas de cada uma é suposição minha,
-- confira e renomeie em Configurações.
INSERT INTO public.sistema_meios_pagamento (nome, taxa_pct, ativo)
SELECT v.nome, v.taxa, true
FROM (VALUES
  ('Pix',                       0.000),
  ('Dinheiro',                  0.000),
  ('Boleto',                    0.000),
  ('Transferência',             0.000),
  ('Cartão de débito',          0.000),
  ('Cartão de crédito 1x',      3.660),
  ('Cartão de crédito até 3x',  4.580),
  ('Cartão de crédito até 6x',  5.470),
  ('Cartão de crédito até 10x', 6.360),
  ('Cartão de crédito 12x',     7.250)
) AS v(nome, taxa)
WHERE NOT EXISTS (SELECT 1 FROM public.sistema_meios_pagamento);


-- ---------------------------------------------------------------------
-- 2) Conferência na venda
-- ---------------------------------------------------------------------
ALTER TABLE public.sistema_calcme_vendas
  ADD COLUMN IF NOT EXISTS meio_pagamento_id uuid REFERENCES public.sistema_meios_pagamento(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conferido_em      timestamptz,
  ADD COLUMN IF NOT EXISTS conferido_por     uuid,
  ADD COLUMN IF NOT EXISTS observacoes       text;

CREATE INDEX IF NOT EXISTS idx_calcme_vendas_conferido
  ON public.sistema_calcme_vendas(conferido_em);

COMMENT ON COLUMN public.sistema_calcme_vendas.conferido_em IS
  'Quando a venda foi conferida no fluxo. Venda não conferida ENTRA no dashboard mesmo assim — o faturamento é real; o que fica sinalizado é a confiança do custo.';


-- ---------------------------------------------------------------------
-- 3) Views recriadas com a taxa vinda do meio de pagamento
--    (a view de resultado depende da de item, então caem juntas)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.sistema_venda_resultado;
DROP VIEW IF EXISTS public.sistema_venda_item_resultado;

CREATE VIEW public.sistema_venda_item_resultado
WITH (security_invoker = true) AS
SELECT
  i.id,
  i.venda_id,
  i.calcme_item_id,
  i.calcme_produto_id,
  i.produto_nome,
  i.quantidade,
  i.valor_unitario,
  i.valor_total,

  COALESCE(i.custo_unitario, cp.custo_unitario, cn.custo_unitario) AS custo_unitario,
  CASE
    WHEN i.custo_unitario  IS NOT NULL THEN 'item'
    WHEN cp.custo_unitario IS NOT NULL THEN 'produto'
    WHEN cn.custo_unitario IS NOT NULL THEN 'nome'
    ELSE 'ausente'
  END AS custo_fonte,

  (COALESCE(i.custo_unitario, cp.custo_unitario, cn.custo_unitario, 0) * i.quantidade)::numeric(14,2) AS custo_total,
  COALESCE(i.terceirizada_unit, 0)                                                                    AS terceirizada_unit,
  (COALESCE(i.terceirizada_unit, 0) * i.quantidade)::numeric(14,2)                                    AS terceirizada_total,

  COALESCE(i.imposto_pct,  v.imposto_pct,  cfg.imposto_pct)  AS imposto_pct,
  COALESCE(i.comissao_pct, v.comissao_pct, cfg.comissao_pct) AS comissao_pct,
  -- taxa de cartão: item → pedido → meio de pagamento → padrão
  COALESCE(i.taxa_cartao_pct, v.taxa_cartao_pct, mp.taxa_pct, cfg.taxa_cartao_pct) AS taxa_cartao_pct,

  (i.valor_total * COALESCE(i.imposto_pct,  v.imposto_pct,  cfg.imposto_pct)  / 100)::numeric(14,2) AS imposto_valor,
  (i.valor_total * COALESCE(i.comissao_pct, v.comissao_pct, cfg.comissao_pct) / 100)::numeric(14,2) AS comissao_valor,
  (i.valor_total * COALESCE(i.taxa_cartao_pct, v.taxa_cartao_pct, mp.taxa_pct, cfg.taxa_cartao_pct) / 100)::numeric(14,2) AS taxa_cartao_valor,

  -- lucro = venda − custo − terceirizada − deduções sobre a venda
  (
    i.valor_total
    - COALESCE(i.custo_unitario, cp.custo_unitario, cn.custo_unitario, 0) * i.quantidade
    - COALESCE(i.terceirizada_unit, 0) * i.quantidade
    - i.valor_total * (
        COALESCE(i.imposto_pct,  v.imposto_pct,  cfg.imposto_pct)
      + COALESCE(i.comissao_pct, v.comissao_pct, cfg.comissao_pct)
      + COALESCE(i.taxa_cartao_pct, v.taxa_cartao_pct, mp.taxa_pct, cfg.taxa_cartao_pct)
      ) / 100
  )::numeric(14,2) AS lucro,

  (COALESCE(i.custo_unitario, cp.custo_unitario, cn.custo_unitario) IS NULL) AS sem_custo

FROM public.sistema_calcme_venda_itens i
JOIN public.sistema_calcme_vendas v ON v.id = i.venda_id
CROSS JOIN public.sistema_financeiro_config cfg
LEFT JOIN public.sistema_meios_pagamento mp ON mp.id = v.meio_pagamento_id
LEFT JOIN public.sistema_custo_produto cp
       ON cp.calcme_produto_id IS NOT NULL
      AND cp.calcme_produto_id = i.calcme_produto_id
LEFT JOIN public.sistema_custo_produto cn
       ON cn.nome_chave = lower(btrim(i.produto_nome));

CREATE VIEW public.sistema_venda_resultado
WITH (security_invoker = true) AS
SELECT
  venda_id,
  SUM(custo_total)::numeric(14,2)        AS cmv,
  SUM(terceirizada_total)::numeric(14,2) AS terceirizada,
  SUM(imposto_valor)::numeric(14,2)      AS imposto,
  SUM(comissao_valor)::numeric(14,2)     AS comissao,
  SUM(taxa_cartao_valor)::numeric(14,2)  AS taxa_cartao,
  SUM(lucro)::numeric(14,2)              AS lucro,
  COUNT(*)::int                          AS itens_total,
  COUNT(*) FILTER (WHERE sem_custo)::int AS itens_sem_custo
FROM public.sistema_venda_item_resultado
GROUP BY venda_id;

-- Views novas nascem com acesso a PUBLIC; fecha como nas demais.
REVOKE ALL ON public.sistema_venda_item_resultado FROM PUBLIC, anon;
REVOKE ALL ON public.sistema_venda_resultado      FROM PUBLIC, anon;
GRANT SELECT ON public.sistema_venda_item_resultado TO authenticated;
GRANT SELECT ON public.sistema_venda_resultado      TO authenticated;


-- ---------------------------------------------------------------------
-- 4) Lista de vendas do fluxo de conferência
--    p_status: 'todas' | 'pendentes' | 'conferidas'
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sistema_vendas_conferencia(
  p_inicio date DEFAULT NULL,
  p_fim    date DEFAULT NULL,
  p_status text DEFAULT 'todas',
  p_busca  text DEFAULT NULL,
  p_limite integer DEFAULT 100
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH par AS (
  SELECT
    COALESCE(p_inicio, date_trunc('month', (now() AT TIME ZONE 'America/Sao_Paulo'))::date) AS ini,
    COALESCE(p_fim,    (now() AT TIME ZONE 'America/Sao_Paulo')::date)                      AS fim
),
base AS (
  SELECT v.id, v.calcme_order_idint, v.cliente_nome, v.data, v.valor_total,
         v.status_titulo, v.conferido_em, v.meio_pagamento_id,
         mp.nome AS meio_pagamento_nome,
         v.itens_sincronizados_em,
         COALESCE(r.cmv, 0)          AS cmv,
         COALESCE(r.lucro, 0)        AS lucro,
         COALESCE(r.itens_total, 0)  AS itens_total,
         COALESCE(r.itens_sem_custo, 0) AS itens_sem_custo
  FROM public.sistema_calcme_vendas v
  LEFT JOIN public.sistema_venda_resultado r  ON r.venda_id = v.id
  LEFT JOIN public.sistema_meios_pagamento mp ON mp.id = v.meio_pagamento_id
  WHERE v.cancelado = false
    AND v.data BETWEEN (SELECT ini FROM par) AND (SELECT fim FROM par)
    AND (p_status = 'todas'
      OR (p_status = 'pendentes'  AND v.conferido_em IS NULL)
      OR (p_status = 'conferidas' AND v.conferido_em IS NOT NULL))
    AND (p_busca IS NULL OR btrim(p_busca) = ''
      OR v.cliente_nome ILIKE '%' || btrim(p_busca) || '%'
      OR v.calcme_order_idint::text ILIKE '%' || btrim(p_busca) || '%')
)
SELECT json_build_object(
  'periodo', json_build_object('inicio', (SELECT ini FROM par), 'fim', (SELECT fim FROM par)),
  'total',      (SELECT COUNT(*) FROM base),
  'pendentes',  (SELECT COUNT(*) FROM base WHERE conferido_em IS NULL),
  'sem_custo',  (SELECT COUNT(*) FROM base WHERE itens_sem_custo > 0),
  'vendas', COALESCE((
    SELECT json_agg(t ORDER BY t.data DESC, t.calcme_order_idint DESC)
    FROM (SELECT * FROM base ORDER BY data DESC LIMIT GREATEST(p_limite, 1)) t
  ), '[]'::json)
);
$$;

REVOKE ALL ON FUNCTION public.sistema_vendas_conferencia(date, date, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sistema_vendas_conferencia(date, date, text, text, integer) TO authenticated;


-- ---------------------------------------------------------------------
-- 5) Uma venda com seus itens e o custo já resolvido
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sistema_venda_detalhe(p_venda_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
SELECT json_build_object(
  'venda', (
    SELECT json_build_object(
      'id', v.id,
      'numero', v.calcme_order_idint,
      'cliente_nome', v.cliente_nome,
      'data', v.data,
      'valor_total', v.valor_total,
      'status_titulo', v.status_titulo,
      'conferido_em', v.conferido_em,
      'observacoes', v.observacoes,
      'meio_pagamento_id', v.meio_pagamento_id,
      'imposto_pct', v.imposto_pct,
      'comissao_pct', v.comissao_pct,
      'taxa_cartao_pct', v.taxa_cartao_pct,
      'itens_sincronizados_em', v.itens_sincronizados_em
    )
    FROM public.sistema_calcme_vendas v WHERE v.id = p_venda_id
  ),
  'itens', COALESCE((
    SELECT json_agg(t ORDER BY t.produto_nome)
    FROM (
      SELECT r.id, r.calcme_produto_id, r.produto_nome, r.quantidade,
             r.valor_unitario, r.valor_total,
             r.custo_unitario, r.custo_fonte, r.custo_total,
             r.terceirizada_unit, r.terceirizada_total,
             r.imposto_pct, r.comissao_pct, r.taxa_cartao_pct,
             r.imposto_valor, r.comissao_valor, r.taxa_cartao_valor,
             r.lucro, r.sem_custo,
             i.custo_unitario AS custo_override
      FROM public.sistema_venda_item_resultado r
      JOIN public.sistema_calcme_venda_itens i ON i.id = r.id
      WHERE r.venda_id = p_venda_id
    ) t
  ), '[]'::json),
  'totais', (
    SELECT json_build_object(
      'cmv', COALESCE(cmv, 0), 'terceirizada', COALESCE(terceirizada, 0),
      'imposto', COALESCE(imposto, 0), 'comissao', COALESCE(comissao, 0),
      'taxa_cartao', COALESCE(taxa_cartao, 0), 'lucro', COALESCE(lucro, 0),
      'itens_total', COALESCE(itens_total, 0), 'itens_sem_custo', COALESCE(itens_sem_custo, 0)
    )
    FROM public.sistema_venda_resultado WHERE venda_id = p_venda_id
  ),
  'meios_pagamento', COALESCE((
    SELECT json_agg(t ORDER BY t.nome)
    FROM (SELECT id, nome, taxa_pct FROM public.sistema_meios_pagamento WHERE ativo) t
  ), '[]'::json)
);
$$;

REVOKE ALL ON FUNCTION public.sistema_venda_detalhe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sistema_venda_detalhe(uuid) TO authenticated;


-- ---------------------------------------------------------------------
-- 6) Fecha também a RPC do dashboard criada antes desta migration
--    (idempotente: repetir não faz mal)
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.sistema_dashboard_financeiro(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sistema_dashboard_financeiro(date, date) TO authenticated;
