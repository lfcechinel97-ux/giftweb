-- =====================================================================
-- INTEGRAÇÃO CALCME → GIFT WEB — Etapa 1 (importação de pedidos)
-- Aditiva: não remove nem renomeia nada existente.
-- =====================================================================

-- 1) Colunas de rastreio do Calcme em sistema_pedidos
ALTER TABLE public.sistema_pedidos
  ADD COLUMN IF NOT EXISTS calcme_order_id text,
  ADD COLUMN IF NOT EXISTS calcme_order_idint integer,
  ADD COLUMN IF NOT EXISTS calcme_status text,
  ADD COLUMN IF NOT EXISTS calcme_vendedor_nome text,
  ADD COLUMN IF NOT EXISTS calcme_data_entrega date,
  ADD COLUMN IF NOT EXISTS calcme_raw jsonb,
  ADD COLUMN IF NOT EXISTS calcme_synced_at timestamptz;

-- Identificador externo único: impede pedido duplicado do Calcme
CREATE UNIQUE INDEX IF NOT EXISTS sistema_pedidos_calcme_order_id_key
  ON public.sistema_pedidos (calcme_order_id)
  WHERE calcme_order_id IS NOT NULL;

-- 2) Itens dos pedidos importados do Calcme
CREATE TABLE public.sistema_calcme_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.sistema_pedidos(id) ON DELETE CASCADE,
  item_id uuid,                 -- id do item dentro do jsonb sistema_pedidos.itens (vínculo p/ futuro PCP)
  calcme_item_id text NOT NULL UNIQUE,
  calcme_item_idint integer,
  calcme_produto_id text,
  calcme_produto_idint integer,
  nome text,
  descricao text,               -- personalização (ex.: "Personalização DTF UV")
  observacoes text,
  quantidade numeric(12,3),
  valor_unitario numeric(12,2),
  valor_total numeric(12,2),
  raw jsonb,                    -- dados originais do item retornados pela API
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_calcme_itens TO authenticated;
GRANT ALL ON public.sistema_calcme_itens TO service_role;

ALTER TABLE public.sistema_calcme_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_sistema_calcme_itens" ON public.sistema_calcme_itens
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_calcme_itens_pedido ON public.sistema_calcme_itens(pedido_id);

-- 3) Metadados dos arquivos anexados aos itens (a arte NÃO é baixada nesta etapa)
CREATE TABLE public.sistema_calcme_item_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.sistema_calcme_itens(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.sistema_pedidos(id) ON DELETE CASCADE,
  calcme_item_id text NOT NULL,
  file_name text,
  file_hash text,
  categoria text,
  is_operation_file boolean NOT NULL DEFAULT false,
  is_order_file boolean NOT NULL DEFAULT false,
  is_production_file boolean NOT NULL DEFAULT false,
  raw jsonb,                    -- dados originais do arquivo retornados pela API
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, file_hash)   -- anti-duplicação de anexos
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_calcme_item_arquivos TO authenticated;
GRANT ALL ON public.sistema_calcme_item_arquivos TO service_role;

ALTER TABLE public.sistema_calcme_item_arquivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_sistema_calcme_item_arquivos" ON public.sistema_calcme_item_arquivos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_calcme_arquivos_item ON public.sistema_calcme_item_arquivos(item_id);
CREATE INDEX IF NOT EXISTS idx_calcme_arquivos_pedido ON public.sistema_calcme_item_arquivos(pedido_id);

-- 4) Log das sincronizações
CREATE TABLE public.sistema_calcme_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  synced_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'success',
  found integer NOT NULL DEFAULT 0,
  imported integer NOT NULL DEFAULT 0,
  updated integer NOT NULL DEFAULT 0,
  ignored integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  detalhes jsonb
);

GRANT SELECT, INSERT ON public.sistema_calcme_sync_log TO authenticated;
GRANT ALL ON public.sistema_calcme_sync_log TO service_role;

ALTER TABLE public.sistema_calcme_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_sistema_calcme_sync_log" ON public.sistema_calcme_sync_log
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_insert_sistema_calcme_sync_log" ON public.sistema_calcme_sync_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- 5) Trigger de criação automática de itens no PCP: pedidos importados do
--    Calcme NÃO entram no PCP nesta etapa (ficam apenas preparados).
--    Pedidos normais do Gift Web continuam entrando automaticamente.
CREATE OR REPLACE FUNCTION public.sistema_criar_producao_inicial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare item jsonb;
begin
  -- Pedidos importados do Calcme: não gerar cartões de produção nesta etapa
  if new.calcme_order_id is not null then
    return new;
  end if;

  for item in select * from jsonb_array_elements(coalesce(new.itens, '[]'::jsonb))
  loop
    insert into sistema_producao_itens (pedido_id, item_id)
    values (new.id, (item->>'id')::uuid)
    on conflict (pedido_id, item_id) do nothing;
  end loop;
  return new;
end; $function$;