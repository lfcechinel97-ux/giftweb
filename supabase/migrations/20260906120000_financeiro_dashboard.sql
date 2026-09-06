-- =====================================================================
-- FINANCEIRO / DASHBOARD — estrutura
--
-- O modelo abaixo é o da planilha "Fechamento Produtos", conferido
-- linha a linha. Lucro de um item de pedido:
--
--   lucro = venda_total
--         − custo_total                      (custo do produto × qtd)
--         − terceirizada_total
--         − venda_total × (imposto% + comissão% + taxa_cartão%)
--
--   Conferido no pedido 100571 / MOCHILA NYLON 28L:
--     5288 − 2712 − 240 − 8,04%×5288 = 1.910,84  ✓ (igual à planilha)
--
-- Imposto, comissão e taxa de cartão são DEDUÇÕES SOBRE A VENDA, não
-- despesas lançadas. Elas também aparecem na previsão orçamentária, mas
-- lá são apenas META — lançá-las como despesa contaria o mesmo dinheiro
-- duas vezes.
--
-- Duas leituras de dinheiro, ambas no dashboard:
--   • VENDIDO   → soma dos pedidos pela data do pedido
--   • RECEBIDO  → soma dos recebimentos pela data em que o dinheiro entrou
--
-- Por que um espelho de vendas separado de sistema_pedidos:
--   sync-calcme-orders importa APENAS 7 status de PCP (é o que o
--   Pedidos/PCP precisam). Dos 608 pedidos do Calcme, 571 estão em
--   "Coletado e Enviado" e ficam de fora — 94% do faturamento. O
--   dashboard precisa de todos, então espelhamos todos aqui sem tocar
--   no fluxo de produção, que continua como está.
--
-- Aditiva: não remove nem renomeia nada existente.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) Parâmetros do financeiro (linha única)
--    Percentuais padrão, usados quando o item/pedido não traz o seu.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_financeiro_config (
  id               boolean PRIMARY KEY DEFAULT true CHECK (id),
  imposto_pct      numeric(6,3) NOT NULL DEFAULT 8.04,   -- Simples Nacional
  comissao_pct     numeric(6,3) NOT NULL DEFAULT 0,      -- varia por vendedor (3% ou 5%)
  taxa_cartao_pct  numeric(6,3) NOT NULL DEFAULT 0,      -- varia por parcelamento (3,66% a 7,25%)
  updated_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sistema_financeiro_config (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.sistema_financeiro_config TO authenticated;
GRANT ALL ON public.sistema_financeiro_config TO service_role;
ALTER TABLE public.sistema_financeiro_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all" ON public.sistema_financeiro_config;
CREATE POLICY "admin all" ON public.sistema_financeiro_config
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

COMMENT ON TABLE public.sistema_financeiro_config IS
  'Percentuais padrão de dedução sobre venda. Comissão e taxa de cartão nascem 0: variam caso a caso e chutar um valor distorceria o lucro em silêncio.';


-- ---------------------------------------------------------------------
-- 2) Espelho financeiro dos pedidos do Calcme (TODOS os status)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_calcme_vendas (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calcme_order_id    text NOT NULL UNIQUE,
  calcme_order_idint integer,
  cliente_nome       text,
  data               date,
  valor_total        numeric(12,2) NOT NULL DEFAULT 0,
  status_titulo      text,
  cancelado          boolean NOT NULL DEFAULT false,
  -- Deduções do pedido inteiro. NULL = herda de sistema_financeiro_config.
  imposto_pct        numeric(6,3),
  comissao_pct       numeric(6,3),
  taxa_cartao_pct    numeric(6,3),
  -- Canal de origem, como na coluna da planilha de fechamento
  canal              text,   -- trafego_pago | organico | disparo | indicacao | outro
  -- vínculo opcional com o pedido de produção, quando também foi importado
  pedido_id          uuid REFERENCES public.sistema_pedidos(id) ON DELETE SET NULL,
  itens_sincronizados_em timestamptz,
  raw                jsonb,
  synced_at          timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_calcme_vendas TO authenticated;
GRANT ALL ON public.sistema_calcme_vendas TO service_role;
ALTER TABLE public.sistema_calcme_vendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all" ON public.sistema_calcme_vendas;
CREATE POLICY "admin all" ON public.sistema_calcme_vendas
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE INDEX IF NOT EXISTS idx_calcme_vendas_data   ON public.sistema_calcme_vendas(data DESC);
CREATE INDEX IF NOT EXISTS idx_calcme_vendas_status ON public.sistema_calcme_vendas(status_titulo);
CREATE INDEX IF NOT EXISTS idx_calcme_vendas_pedido ON public.sistema_calcme_vendas(pedido_id);


-- ---------------------------------------------------------------------
-- 3) Itens das vendas — a base do CMV
--    Buscados por período, não em todo sync: são 608 pedidos e a API do
--    Calcme cobra uma requisição por pedido.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_calcme_venda_itens (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  venda_id          uuid NOT NULL REFERENCES public.sistema_calcme_vendas(id) ON DELETE CASCADE,
  calcme_item_id    text NOT NULL UNIQUE,
  calcme_produto_id text,
  produto_nome      text,
  quantidade        numeric(12,3) NOT NULL DEFAULT 0,
  valor_unitario    numeric(12,2) NOT NULL DEFAULT 0,
  valor_total       numeric(12,2) NOT NULL DEFAULT 0,
  -- Custo informado À MÃO para ESTE item. NULL = usa o catálogo de custo.
  custo_unitario    numeric(12,2),
  -- Serviço de terceiro neste item (gravação, bordado...), por unidade
  terceirizada_unit numeric(12,2),
  -- Deduções específicas deste item. NULL = herda do pedido, depois do padrão.
  imposto_pct       numeric(6,3),
  comissao_pct      numeric(6,3),
  taxa_cartao_pct   numeric(6,3),
  raw               jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_calcme_venda_itens TO authenticated;
GRANT ALL ON public.sistema_calcme_venda_itens TO service_role;
ALTER TABLE public.sistema_calcme_venda_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all" ON public.sistema_calcme_venda_itens;
CREATE POLICY "admin all" ON public.sistema_calcme_venda_itens
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE INDEX IF NOT EXISTS idx_calcme_venda_itens_venda   ON public.sistema_calcme_venda_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_calcme_venda_itens_produto ON public.sistema_calcme_venda_itens(calcme_produto_id);
CREATE INDEX IF NOT EXISTS idx_calcme_venda_itens_nome    ON public.sistema_calcme_venda_itens(lower(produto_nome));


-- ---------------------------------------------------------------------
-- 4) Catálogo de custo por produto
--    É o que torna "custo por item" viável em 608 pedidos: informa-se o
--    custo da "Caneca Café 180ml Inox" uma vez e todos os pedidos que a
--    contêm herdam. O item ainda pode sobrescrever quando o preço mudou.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_custo_produto (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_nome      text NOT NULL,
  nome_chave        text GENERATED ALWAYS AS (lower(btrim(produto_nome))) STORED,
  calcme_produto_id text,
  custo_unitario    numeric(12,2) NOT NULL CHECK (custo_unitario >= 0),
  -- de onde veio: manual | planilha | catalogo (products_cache.preco_custo)
  origem            text NOT NULL DEFAULT 'manual',
  observacoes       text,
  atualizado_por    uuid DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sistema_custo_produto_nome_key
  ON public.sistema_custo_produto (nome_chave);
CREATE UNIQUE INDEX IF NOT EXISTS sistema_custo_produto_calcme_key
  ON public.sistema_custo_produto (calcme_produto_id)
  WHERE calcme_produto_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_custo_produto TO authenticated;
GRANT ALL ON public.sistema_custo_produto TO service_role;
ALTER TABLE public.sistema_custo_produto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all" ON public.sistema_custo_produto;
CREATE POLICY "admin all" ON public.sistema_custo_produto
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());


-- ---------------------------------------------------------------------
-- 5) Categorias de despesa — os 3 grupos da previsão orçamentária
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_despesa_categorias (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  grupo      text NOT NULL DEFAULT 'variavel' CHECK (grupo IN ('pessoal','fixa','variavel')),
  cor        text,
  ativo      boolean NOT NULL DEFAULT true,
  ordem      integer NOT NULL DEFAULT 0,
  -- true quando a categoria já é deduzida por item (imposto, comissão,
  -- taxa de cartão). Bloqueia lançamento manual para não contar em dobro.
  deduzida_na_venda boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_despesa_categorias TO authenticated;
GRANT ALL ON public.sistema_despesa_categorias TO service_role;
ALTER TABLE public.sistema_despesa_categorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all" ON public.sistema_despesa_categorias;
CREATE POLICY "admin all" ON public.sistema_despesa_categorias
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Categorias exatamente como na PREVISÃO ORÇAMENTÁRIA GIFT WEB
INSERT INTO public.sistema_despesa_categorias (nome, grupo, cor, ordem, deduzida_na_venda) VALUES
  -- pessoal
  ('Funcionários',          'pessoal',  '#0EA36B',  10, false),
  ('Medicina do trabalho',  'pessoal',  '#0EA36B',  20, false),
  ('Sindicato',             'pessoal',  '#0EA36B',  30, false),
  ('Pró-labore',            'pessoal',  '#0EA36B',  40, false),
  -- fixas
  ('Aluguel',               'fixa',     '#5B52E8', 110, false),
  ('Energia',               'fixa',     '#5B52E8', 120, false),
  ('Água',                  'fixa',     '#5B52E8', 130, false),
  ('Internet',              'fixa',     '#5B52E8', 140, false),
  ('Contabilidade',         'fixa',     '#5B52E8', 150, false),
  ('Alvará',                'fixa',     '#5B52E8', 160, false),
  ('Canva',                 'fixa',     '#7C5CFF', 170, false),
  ('ChatGPT',               'fixa',     '#7C5CFF', 180, false),
  ('Calcme',                'fixa',     '#7C5CFF', 190, false),
  ('Vectorizer',            'fixa',     '#7C5CFF', 200, false),
  ('Hospedagem do site',    'fixa',     '#7C5CFF', 210, false),
  ('Time is Money',         'fixa',     '#7C5CFF', 220, false),
  ('Verisure',              'fixa',     '#5B52E8', 230, false),
  ('Material de limpeza',   'fixa',     '#5B52E8', 240, false),
  ('Despesas bancárias',    'fixa',     '#5B52E8', 250, false),
  ('Taxa de capitalização', 'fixa',     '#5B52E8', 260, false),
  ('Retirada mãe',          'fixa',     '#47536B', 270, false),
  ('Empréstimo pai',        'fixa',     '#47536B', 280, false),
  ('Doação',                'fixa',     '#47536B', 290, false),
  ('Confraternização',      'fixa',     '#47536B', 300, false),
  -- variáveis
  ('ADS',                   'variavel', '#F5A524', 410, false),
  ('Transporte',            'variavel', '#0EA5A5', 420, false),
  ('Compra de mercadoria',  'variavel', '#F76B15', 430, false),
  ('Terceirização',         'variavel', '#8B5CF6', 440, false),
  ('Insumos de produção',   'variavel', '#2C5FF6', 450, false),
  ('Material de escritório','variavel', '#6B7A8F', 460, false),
  ('Patrocínio',            'variavel', '#F5A524', 470, false),
  -- deduzidas por item: existem para a comparação com a meta, não para lançar
  ('Imposto',               'variavel', '#E5484D', 480, true),
  ('Taxa de cartão',        'variavel', '#E5484D', 490, true),
  ('Comissão',              'variavel', '#E5484D', 500, true),
  ('Outros',                'variavel', '#8A96A6', 999, false)
ON CONFLICT (nome) DO NOTHING;


-- ---------------------------------------------------------------------
-- 6) Previsão orçamentária — a meta por categoria e mês
--    competencia = primeiro dia do mês. Sem linha para o mês, o
--    dashboard cai no mês-modelo mais recente já cadastrado.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_orcamento (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competencia  date NOT NULL,
  categoria_id uuid NOT NULL REFERENCES public.sistema_despesa_categorias(id) ON DELETE CASCADE,
  previsto     numeric(12,2) NOT NULL DEFAULT 0 CHECK (previsto >= 0),
  observacoes  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competencia, categoria_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_orcamento TO authenticated;
GRANT ALL ON public.sistema_orcamento TO service_role;
ALTER TABLE public.sistema_orcamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all" ON public.sistema_orcamento;
CREATE POLICY "admin all" ON public.sistema_orcamento
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE INDEX IF NOT EXISTS idx_sistema_orcamento_comp ON public.sistema_orcamento(competencia DESC);


-- ---------------------------------------------------------------------
-- 7) Despesas — o que sai do caixa
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_despesas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data              date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  descricao         text NOT NULL,
  valor             numeric(12,2) NOT NULL CHECK (valor >= 0),
  categoria_id      uuid REFERENCES public.sistema_despesa_categorias(id) ON DELETE SET NULL,
  -- vínculos opcionais
  venda_id          uuid REFERENCES public.sistema_calcme_vendas(id) ON DELETE SET NULL,
  fornecedor_id     uuid REFERENCES public.sistema_fornecedores(id) ON DELETE SET NULL,
  meio_pagamento_id uuid REFERENCES public.sistema_meios_pagamento(id) ON DELETE SET NULL,
  documento         text,                 -- nº da nota, boleto, comprovante
  observacoes       text,
  pago              boolean NOT NULL DEFAULT true,
  -- origem: manual (você lançou) | calcme (conta a pagar importada)
  origem            text NOT NULL DEFAULT 'manual',
  calcme_bill_id    text UNIQUE,
  criado_por        uuid DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_despesas TO authenticated;
GRANT ALL ON public.sistema_despesas TO service_role;
ALTER TABLE public.sistema_despesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all" ON public.sistema_despesas;
CREATE POLICY "admin all" ON public.sistema_despesas
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE INDEX IF NOT EXISTS idx_sistema_despesas_data      ON public.sistema_despesas(data DESC);
CREATE INDEX IF NOT EXISTS idx_sistema_despesas_categoria ON public.sistema_despesas(categoria_id);
CREATE INDEX IF NOT EXISTS idx_sistema_despesas_venda     ON public.sistema_despesas(venda_id);


-- ---------------------------------------------------------------------
-- 8) Recebimentos — o que entra no caixa
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_recebimentos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data              date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  valor             numeric(12,2) NOT NULL CHECK (valor >= 0),
  venda_id          uuid REFERENCES public.sistema_calcme_vendas(id) ON DELETE SET NULL,
  descricao         text,
  meio_pagamento_id uuid REFERENCES public.sistema_meios_pagamento(id) ON DELETE SET NULL,
  documento         text,
  observacoes       text,
  origem            text NOT NULL DEFAULT 'manual',
  calcme_bill_id    text UNIQUE,
  criado_por        uuid DEFAULT auth.uid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_recebimentos TO authenticated;
GRANT ALL ON public.sistema_recebimentos TO service_role;
ALTER TABLE public.sistema_recebimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all" ON public.sistema_recebimentos;
CREATE POLICY "admin all" ON public.sistema_recebimentos
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE INDEX IF NOT EXISTS idx_sistema_recebimentos_data  ON public.sistema_recebimentos(data DESC);
CREATE INDEX IF NOT EXISTS idx_sistema_recebimentos_venda ON public.sistema_recebimentos(venda_id);


-- ---------------------------------------------------------------------
-- 9) Log das sincronizações financeiras
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sistema_financeiro_sync_log (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  status    text NOT NULL,
  vendas    integer NOT NULL DEFAULT 0,
  itens     integer NOT NULL DEFAULT 0,
  contas    integer NOT NULL DEFAULT 0,
  errors    integer NOT NULL DEFAULT 0,
  detalhes  jsonb
);

GRANT SELECT, INSERT ON public.sistema_financeiro_sync_log TO authenticated;
GRANT ALL ON public.sistema_financeiro_sync_log TO service_role;
ALTER TABLE public.sistema_financeiro_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin all" ON public.sistema_financeiro_sync_log;
CREATE POLICY "admin all" ON public.sistema_financeiro_sync_log
  FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE INDEX IF NOT EXISTS idx_financeiro_sync_log_at ON public.sistema_financeiro_sync_log(synced_at DESC);


-- ---------------------------------------------------------------------
-- 10) updated_at automático
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sistema_financeiro_set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_sistema_despesas_updated ON public.sistema_despesas;
CREATE TRIGGER trg_sistema_despesas_updated BEFORE UPDATE ON public.sistema_despesas
  FOR EACH ROW EXECUTE FUNCTION public.sistema_financeiro_set_updated_at();

DROP TRIGGER IF EXISTS trg_sistema_recebimentos_updated ON public.sistema_recebimentos;
CREATE TRIGGER trg_sistema_recebimentos_updated BEFORE UPDATE ON public.sistema_recebimentos
  FOR EACH ROW EXECUTE FUNCTION public.sistema_financeiro_set_updated_at();

DROP TRIGGER IF EXISTS trg_sistema_venda_itens_updated ON public.sistema_calcme_venda_itens;
CREATE TRIGGER trg_sistema_venda_itens_updated BEFORE UPDATE ON public.sistema_calcme_venda_itens
  FOR EACH ROW EXECUTE FUNCTION public.sistema_financeiro_set_updated_at();

DROP TRIGGER IF EXISTS trg_sistema_custo_produto_updated ON public.sistema_custo_produto;
CREATE TRIGGER trg_sistema_custo_produto_updated BEFORE UPDATE ON public.sistema_custo_produto
  FOR EACH ROW EXECUTE FUNCTION public.sistema_financeiro_set_updated_at();

DROP TRIGGER IF EXISTS trg_sistema_orcamento_updated ON public.sistema_orcamento;
CREATE TRIGGER trg_sistema_orcamento_updated BEFORE UPDATE ON public.sistema_orcamento
  FOR EACH ROW EXECUTE FUNCTION public.sistema_financeiro_set_updated_at();


-- ---------------------------------------------------------------------
-- 11) Resultado por item — a fórmula da planilha, em SQL
--     Cascatas:
--       custo  : override do item → catálogo por produto_id → por nome
--       %      : item → pedido → sistema_financeiro_config
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.sistema_venda_item_resultado
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
  (COALESCE(i.terceirizada_unit, 0) * i.quantidade)::numeric(14,2)                                     AS terceirizada_total,

  COALESCE(i.imposto_pct,     v.imposto_pct,     cfg.imposto_pct)     AS imposto_pct,
  COALESCE(i.comissao_pct,    v.comissao_pct,    cfg.comissao_pct)    AS comissao_pct,
  COALESCE(i.taxa_cartao_pct, v.taxa_cartao_pct, cfg.taxa_cartao_pct) AS taxa_cartao_pct,

  (i.valor_total * COALESCE(i.imposto_pct,     v.imposto_pct,     cfg.imposto_pct)     / 100)::numeric(14,2) AS imposto_valor,
  (i.valor_total * COALESCE(i.comissao_pct,    v.comissao_pct,    cfg.comissao_pct)    / 100)::numeric(14,2) AS comissao_valor,
  (i.valor_total * COALESCE(i.taxa_cartao_pct, v.taxa_cartao_pct, cfg.taxa_cartao_pct) / 100)::numeric(14,2) AS taxa_cartao_valor,

  -- lucro = venda − custo − terceirizada − deduções sobre a venda
  (
    i.valor_total
    - COALESCE(i.custo_unitario, cp.custo_unitario, cn.custo_unitario, 0) * i.quantidade
    - COALESCE(i.terceirizada_unit, 0) * i.quantidade
    - i.valor_total * (
        COALESCE(i.imposto_pct,     v.imposto_pct,     cfg.imposto_pct)
      + COALESCE(i.comissao_pct,    v.comissao_pct,    cfg.comissao_pct)
      + COALESCE(i.taxa_cartao_pct, v.taxa_cartao_pct, cfg.taxa_cartao_pct)
      ) / 100
  )::numeric(14,2) AS lucro,

  (COALESCE(i.custo_unitario, cp.custo_unitario, cn.custo_unitario) IS NULL) AS sem_custo

FROM public.sistema_calcme_venda_itens i
JOIN public.sistema_calcme_vendas v ON v.id = i.venda_id
CROSS JOIN public.sistema_financeiro_config cfg
LEFT JOIN public.sistema_custo_produto cp
       ON cp.calcme_produto_id IS NOT NULL
      AND cp.calcme_produto_id = i.calcme_produto_id
LEFT JOIN public.sistema_custo_produto cn
       ON cn.nome_chave = lower(btrim(i.produto_nome));

GRANT SELECT ON public.sistema_venda_item_resultado TO authenticated;


CREATE OR REPLACE VIEW public.sistema_venda_resultado
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

GRANT SELECT ON public.sistema_venda_resultado TO authenticated;


-- ---------------------------------------------------------------------
-- 12) RPC do dashboard — o DRE do período em uma ida ao banco
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sistema_dashboard_financeiro(
  p_inicio date DEFAULT NULL,
  p_fim    date DEFAULT NULL
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
    COALESCE(p_fim,    (now() AT TIME ZONE 'America/Sao_Paulo')::date)                      AS fim,
    (now() AT TIME ZONE 'America/Sao_Paulo')::date                                          AS hoje
),
venda AS (
  SELECT v.id, v.calcme_order_idint, v.cliente_nome, v.data, v.valor_total,
         v.status_titulo, v.canal,
         COALESCE(r.cmv, 0)             AS cmv,
         COALESCE(r.terceirizada, 0)    AS terceirizada,
         COALESCE(r.imposto, 0)         AS imposto,
         COALESCE(r.comissao, 0)        AS comissao,
         COALESCE(r.taxa_cartao, 0)     AS taxa_cartao,
         COALESCE(r.lucro, 0)           AS lucro,
         COALESCE(r.itens_total, 0)     AS itens_total,
         COALESCE(r.itens_sem_custo, 0) AS itens_sem_custo,
         (r.venda_id IS NULL)           AS sem_itens
  FROM public.sistema_calcme_vendas v
  LEFT JOIN public.sistema_venda_resultado r ON r.venda_id = v.id
  WHERE v.cancelado = false
    AND v.data BETWEEN (SELECT ini FROM par) AND (SELECT fim FROM par)
),
rec AS (
  SELECT r.data AS dia, r.valor
  FROM public.sistema_recebimentos r
  WHERE r.data BETWEEN (SELECT ini FROM par) AND (SELECT fim FROM par)
),
dsp AS (
  SELECT d.data AS dia, d.valor, d.categoria_id
  FROM public.sistema_despesas d
  WHERE d.data BETWEEN (SELECT ini FROM par) AND (SELECT fim FROM par)
),
dsp_grupo AS (
  SELECT COALESCE(c.grupo, 'variavel') AS grupo, SUM(d.valor) AS valor
  FROM dsp d
  LEFT JOIN public.sistema_despesa_categorias c ON c.id = d.categoria_id
  GROUP BY COALESCE(c.grupo, 'variavel')
),
dias AS (
  SELECT generate_series((SELECT ini FROM par), (SELECT fim FROM par), interval '1 day')::date AS dia
),
-- Meta do mês do início do período; sem linha para ele, usa a mais recente cadastrada
orc_comp AS (
  SELECT COALESCE(
    (SELECT MAX(competencia) FROM public.sistema_orcamento
      WHERE competencia = date_trunc('month', (SELECT ini FROM par))::date),
    (SELECT MAX(competencia) FROM public.sistema_orcamento)
  ) AS competencia
)
SELECT json_build_object(
  'periodo', json_build_object(
    'inicio', (SELECT ini FROM par),
    'fim',    (SELECT fim FROM par),
    'hoje',   (SELECT hoje FROM par)
  ),

  -- ---- DRE do período ------------------------------------------------
  'dre', json_build_object(
    'receita_bruta', COALESCE((SELECT SUM(valor_total) FROM venda), 0),
    'imposto',       COALESCE((SELECT SUM(imposto)     FROM venda), 0),
    'comissao',      COALESCE((SELECT SUM(comissao)    FROM venda), 0),
    'taxa_cartao',   COALESCE((SELECT SUM(taxa_cartao) FROM venda), 0),
    'deducoes',      COALESCE((SELECT SUM(imposto + comissao + taxa_cartao) FROM venda), 0),
    'cmv',           COALESCE((SELECT SUM(cmv)          FROM venda), 0),
    'terceirizada',  COALESCE((SELECT SUM(terceirizada) FROM venda), 0),
    'margem_contribuicao', COALESCE((SELECT SUM(lucro) FROM venda), 0),
    'despesa_pessoal',  COALESCE((SELECT valor FROM dsp_grupo WHERE grupo = 'pessoal'), 0),
    'despesa_fixa',     COALESCE((SELECT valor FROM dsp_grupo WHERE grupo = 'fixa'), 0),
    'despesa_variavel', COALESCE((SELECT valor FROM dsp_grupo WHERE grupo = 'variavel'), 0),
    'despesas',         COALESCE((SELECT SUM(valor) FROM dsp), 0),
    'resultado', COALESCE((SELECT SUM(lucro) FROM venda), 0)
               - COALESCE((SELECT SUM(valor) FROM dsp), 0)
  ),

  'totais', json_build_object(
    'vendido',  COALESCE((SELECT SUM(valor_total) FROM venda), 0),
    'pedidos',  (SELECT COUNT(*) FROM venda),
    'ticket',   COALESCE((SELECT AVG(valor_total) FROM venda), 0),
    'recebido', COALESCE((SELECT SUM(valor) FROM rec), 0),
    'despesas', COALESCE((SELECT SUM(valor) FROM dsp), 0),
    'caixa',    COALESCE((SELECT SUM(valor) FROM rec), 0) - COALESCE((SELECT SUM(valor) FROM dsp), 0),
    'itens_sem_custo',   COALESCE((SELECT SUM(itens_sem_custo) FROM venda), 0),
    'itens_total',       COALESCE((SELECT SUM(itens_total) FROM venda), 0),
    'pedidos_sem_itens', (SELECT COUNT(*) FROM venda WHERE sem_itens)
  ),

  'hoje', json_build_object(
    'vendido',  COALESCE((SELECT SUM(valor_total) FROM venda WHERE data = (SELECT hoje FROM par)), 0),
    'pedidos',  (SELECT COUNT(*) FROM venda WHERE data = (SELECT hoje FROM par)),
    'lucro',    COALESCE((SELECT SUM(lucro) FROM venda WHERE data = (SELECT hoje FROM par)), 0),
    'recebido', COALESCE((SELECT SUM(valor) FROM rec WHERE dia = (SELECT hoje FROM par)), 0),
    'despesas', COALESCE((SELECT SUM(valor) FROM dsp WHERE dia = (SELECT hoje FROM par)), 0)
  ),

  'serie', COALESCE((
    SELECT json_agg(json_build_object(
      'dia',      d.dia,
      'vendido',  COALESCE(v.s, 0),
      'lucro',    COALESCE(v.l, 0),
      'recebido', COALESCE(r.s, 0),
      'despesas', COALESCE(x.s, 0)
    ) ORDER BY d.dia)
    FROM dias d
    LEFT JOIN (SELECT data AS dia, SUM(valor_total) s, SUM(lucro) l FROM venda GROUP BY data) v ON v.dia = d.dia
    LEFT JOIN (SELECT dia, SUM(valor) s FROM rec GROUP BY dia) r ON r.dia = d.dia
    LEFT JOIN (SELECT dia, SUM(valor) s FROM dsp GROUP BY dia) x ON x.dia = d.dia
  ), '[]'::json),

  -- Realizado x previsto, por categoria
  'orcamento', COALESCE((
    SELECT json_agg(t ORDER BY t.grupo, t.ordem)
    FROM (
      SELECT c.id, c.nome AS categoria, c.grupo, c.cor, c.ordem, c.deduzida_na_venda,
             COALESCE(o.previsto, 0)::numeric(14,2) AS previsto,
             COALESCE((SELECT SUM(valor) FROM dsp WHERE dsp.categoria_id = c.id), 0)::numeric(14,2) AS realizado
      FROM public.sistema_despesa_categorias c
      LEFT JOIN public.sistema_orcamento o
             ON o.categoria_id = c.id
            AND o.competencia = (SELECT competencia FROM orc_comp)
      WHERE c.ativo
        AND (COALESCE(o.previsto, 0) > 0
             OR EXISTS (SELECT 1 FROM dsp WHERE dsp.categoria_id = c.id))
    ) t
  ), '[]'::json),

  'orcamento_competencia', (SELECT competencia FROM orc_comp),

  'despesas_por_categoria', COALESCE((
    SELECT json_agg(t ORDER BY t.valor DESC)
    FROM (
      SELECT COALESCE(cat.nome, 'Sem categoria') AS categoria,
             COALESCE(cat.cor, '#8A96A6')        AS cor,
             COALESCE(cat.grupo, 'variavel')     AS grupo,
             SUM(dsp.valor)::numeric(14,2)       AS valor
      FROM dsp
      LEFT JOIN public.sistema_despesa_categorias cat ON cat.id = dsp.categoria_id
      GROUP BY cat.nome, cat.cor, cat.grupo
    ) t
  ), '[]'::json),

  'top_vendas', COALESCE((
    SELECT json_agg(t)
    FROM (
      SELECT id, calcme_order_idint AS numero, cliente_nome, data, valor_total,
             cmv, lucro, itens_sem_custo, sem_itens, status_titulo
      FROM venda
      ORDER BY valor_total DESC
      LIMIT 8
    ) t
  ), '[]'::json),

  'ultimas_despesas', COALESCE((
    SELECT json_agg(t)
    FROM (
      SELECT d.id, d.data, d.descricao, d.valor, d.origem,
             cat.nome AS categoria, cat.cor, cat.grupo
      FROM public.sistema_despesas d
      LEFT JOIN public.sistema_despesa_categorias cat ON cat.id = d.categoria_id
      ORDER BY d.data DESC, d.created_at DESC
      LIMIT 12
    ) t
  ), '[]'::json),

  'geral', json_build_object(
    'vendido_total',  COALESCE((SELECT SUM(valor_total) FROM public.sistema_calcme_vendas WHERE cancelado = false), 0),
    'recebido_total', COALESCE((SELECT SUM(valor) FROM public.sistema_recebimentos), 0),
    'produtos_sem_custo', (
      SELECT COUNT(*) FROM (
        SELECT DISTINCT lower(btrim(produto_nome)) FROM public.sistema_venda_item_resultado WHERE sem_custo
      ) s
    ),
    'ultima_sync', (SELECT MAX(synced_at) FROM public.sistema_calcme_vendas)
  )
);
$$;

GRANT EXECUTE ON FUNCTION public.sistema_dashboard_financeiro(date, date) TO authenticated;


-- ---------------------------------------------------------------------
-- 13) Realtime: o dashboard reage a lançamento e a sync sem recarregar
-- ---------------------------------------------------------------------
ALTER TABLE public.sistema_despesas           REPLICA IDENTITY FULL;
ALTER TABLE public.sistema_recebimentos       REPLICA IDENTITY FULL;
ALTER TABLE public.sistema_calcme_vendas      REPLICA IDENTITY FULL;
ALTER TABLE public.sistema_calcme_venda_itens REPLICA IDENTITY FULL;
ALTER TABLE public.sistema_custo_produto      REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sistema_despesas',
    'sistema_recebimentos',
    'sistema_calcme_vendas',
    'sistema_calcme_venda_itens',
    'sistema_custo_produto'
  ] LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION
      WHEN duplicate_object THEN NULL;  -- já publicada
      WHEN undefined_object THEN NULL;  -- publicação não existe neste ambiente
    END;
  END LOOP;
END $$;
