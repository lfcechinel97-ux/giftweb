-- 1) Papéis
CREATE TYPE public.app_role AS ENUM ('admin', 'vendedor', 'producao');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "Usuário vê seus papéis" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Semeia papéis a partir dos usuários existentes
INSERT INTO public.user_roles (user_id, role)
SELECT id, CASE WHEN email = 'lfcechinel97@gmail.com' THEN 'admin'::public.app_role
                ELSE 'vendedor'::public.app_role END
FROM public.admin_users
ON CONFLICT DO NOTHING;

-- 2) Auditoria
CREATE TABLE public.sistema_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade text NOT NULL,
  entidade_id uuid,
  entidade_numero text,
  acao text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  usuario_id uuid,
  usuario_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sistema_auditoria_entidade ON public.sistema_auditoria (entidade, entidade_id, created_at DESC);

GRANT SELECT, INSERT ON public.sistema_auditoria TO authenticated;
GRANT ALL ON public.sistema_auditoria TO service_role;
ALTER TABLE public.sistema_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistema lê auditoria" ON public.sistema_auditoria
FOR SELECT TO authenticated USING (public.is_admin_user());

CREATE POLICY "Sistema registra auditoria" ON public.sistema_auditoria
FOR INSERT TO authenticated WITH CHECK (public.is_admin_user());

-- 3) Senha de exclusão (tabela protegida: sem GRANT para anon/authenticated)
CREATE TABLE public.sistema_config (
  chave text PRIMARY KEY,
  valor text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.sistema_config TO service_role;
ALTER TABLE public.sistema_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.sistema_config (chave, valor) VALUES ('senha_exclusao_pedido', '971213')
ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sistema_verificar_senha_exclusao(p_senha text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_ok boolean;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT (valor = COALESCE(p_senha, '')) INTO v_ok
  FROM public.sistema_config WHERE chave = 'senha_exclusao_pedido';
  RETURN COALESCE(v_ok, false);
END;
$$;

REVOKE ALL ON FUNCTION public.sistema_verificar_senha_exclusao(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.sistema_verificar_senha_exclusao(text) TO authenticated;