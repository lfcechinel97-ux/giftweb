
-- Helper: is admin
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.admin_users WHERE id = auth.uid());
$$;

-- Lookup tables
CREATE TABLE public.sistema_vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_vendedores TO authenticated;
GRANT ALL ON public.sistema_vendedores TO service_role;
ALTER TABLE public.sistema_vendedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all" ON public.sistema_vendedores FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.sistema_meios_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_meios_pagamento TO authenticated;
GRANT ALL ON public.sistema_meios_pagamento TO service_role;
ALTER TABLE public.sistema_meios_pagamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all" ON public.sistema_meios_pagamento FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.sistema_transportadoras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  tipo_frete text,
  prazo_entrega int,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_transportadoras TO authenticated;
GRANT ALL ON public.sistema_transportadoras TO service_role;
ALTER TABLE public.sistema_transportadoras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all" ON public.sistema_transportadoras FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.sistema_origens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  meta jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_origens TO authenticated;
GRANT ALL ON public.sistema_origens TO service_role;
ALTER TABLE public.sistema_origens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all" ON public.sistema_origens FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.sistema_clientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL,
  documento text NOT NULL,
  ie text,
  contatos jsonb NOT NULL DEFAULT '[]'::jsonb,
  enderecos jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_clientes TO authenticated;
GRANT ALL ON public.sistema_clientes TO service_role;
ALTER TABLE public.sistema_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all" ON public.sistema_clientes FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.sistema_orcamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  cliente_id uuid,
  contato_nome text,
  contato_telefone text,
  contato_email text,
  vendedor_id uuid,
  origem_id uuid,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  frete_tipo text,
  frete_valor numeric NOT NULL DEFAULT 0,
  transportadora_id uuid,
  prazo_entrega int,
  pagamento_id uuid,
  observacoes text,
  status text NOT NULL DEFAULT 'aberto',
  aprovado_em timestamptz,
  anexo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_orcamentos TO authenticated;
GRANT ALL ON public.sistema_orcamentos TO service_role;
ALTER TABLE public.sistema_orcamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all" ON public.sistema_orcamentos FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.sistema_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  orcamento_id uuid,
  cliente_id uuid,
  contato_nome text,
  contato_telefone text,
  contato_email text,
  vendedor_id uuid,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric NOT NULL DEFAULT 0,
  frete_tipo text,
  frete_valor numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  transportadora_id uuid,
  prazo_entrega int,
  pagamento_id uuid,
  observacoes text,
  status text NOT NULL DEFAULT 'novo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_pedidos TO authenticated;
GRANT ALL ON public.sistema_pedidos TO service_role;
ALTER TABLE public.sistema_pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all" ON public.sistema_pedidos FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

CREATE TABLE public.sistema_ajustes_estoque (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id text,
  codigo_composto text,
  variante_slug text,
  tipo text NOT NULL,
  quantidade int NOT NULL,
  motivo text,
  orcamento_id uuid,
  pedido_id uuid,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_ajustes_estoque TO authenticated;
GRANT ALL ON public.sistema_ajustes_estoque TO service_role;
ALTER TABLE public.sistema_ajustes_estoque ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin all" ON public.sistema_ajustes_estoque FOR ALL TO authenticated USING (public.is_admin_user()) WITH CHECK (public.is_admin_user());

-- Sequence for orcamento numero starting from 125749
CREATE SEQUENCE IF NOT EXISTS public.sistema_orcamento_seq START 125749;
CREATE SEQUENCE IF NOT EXISTS public.sistema_pedido_seq START 1;

CREATE OR REPLACE FUNCTION public.sistema_next_orcamento_numero()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT nextval('public.sistema_orcamento_seq')::text;
$$;

CREATE OR REPLACE FUNCTION public.sistema_next_pedido_numero()
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT 'PED-' || extract(year from now())::text || '-' || lpad(nextval('public.sistema_pedido_seq')::text, 5, '0');
$$;

GRANT EXECUTE ON FUNCTION public.sistema_next_orcamento_numero() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sistema_next_pedido_numero() TO authenticated;

-- Seed default lookups
INSERT INTO public.sistema_meios_pagamento (nome) VALUES ('Boleto 30 dias'),('Cartão de Crédito'),('PIX'),('Transferência');
INSERT INTO public.sistema_origens (nome) VALUES ('Telefone'),('WhatsApp'),('E-mail'),('Indicação'),('Site');
