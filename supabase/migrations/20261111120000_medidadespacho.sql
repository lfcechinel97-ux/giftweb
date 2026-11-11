-- =====================================================================
-- GIFT WEB - Calculadora de volumes de despacho (/medidadespacho)
--
-- As medidas da XBZ (peso/altura/largura/profundidade) já vêm do
-- products_cache, sincronizado todo dia pela edge function sync-products
-- (0 já vira NULL lá). Aqui só entram as tabelas que a API não tem:
--   * xbz_caixa_master  – planilha de caixa master (importada pela página)
--   * medidas_override  – medida fechada/peso informados pela equipe
--   * calc_config       – valores padrão da calculadora
--   * despachos_historico (+ _itens) – despachos reais (calibração)
--
-- Acesso: qualquer pessoa da equipe com conta (linha em admin_users →
-- public.is_admin_user()): admin, gerente e vendedor. Nada é público.
--
-- Pode rodar no SQL Editor de uma vez. É idempotente.
-- =====================================================================

-- 1) Caixa master ------------------------------------------------------
create table if not exists public.xbz_caixa_master (
  id bigserial primary key,
  codigo_xbz text not null,                 -- coluna ID da planilha (X000272)
  referencia text not null,                 -- como veio (#10078#-AZU)
  codigo_composto text not null,            -- referência sem os # (10078-AZU) = products_cache.codigo_amigavel
  descricao text,
  qtd_por_caixa integer,
  largura_cm numeric,
  altura_cm numeric,
  comprimento_cm numeric,
  status_revisao text not null default 'ok' check (status_revisao in ('ok', 'revisar', 'inativo')),
  motivo_revisao text,
  importado_em timestamptz not null default now(),
  importado_por uuid
);
create index if not exists xbz_caixa_master_codigo_composto_idx on public.xbz_caixa_master (codigo_composto);
create index if not exists xbz_caixa_master_codigo_xbz_idx on public.xbz_caixa_master (codigo_xbz);

-- 2) Override manual (por produto = CodigoAmigavel da XBZ, ex.: 01116) ---
create table if not exists public.medidas_override (
  codigo_amigavel text primary key,
  altura_cm numeric check (altura_cm is null or altura_cm > 0),
  largura_cm numeric check (largura_cm is null or largura_cm > 0),
  profundidade_cm numeric check (profundidade_cm is null or profundidade_cm > 0),
  peso_g numeric check (peso_g is null or peso_g > 0),
  fator_compressao numeric check (fator_compressao is null or (fator_compressao > 0 and fator_compressao <= 1)),
  vol_efetivo_un_cm3 numeric check (vol_efetivo_un_cm3 is null or vol_efetivo_un_cm3 > 0), -- "promover a override" da calibração
  observacao text,
  atualizado_por uuid default auth.uid(),
  atualizado_em timestamptz not null default now()
);

-- 3) Configuração --------------------------------------------------------
create table if not exists public.calc_config (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now()
);
insert into public.calc_config (chave, valor) values
  ('caixa_padrao', '{"largura": 60, "altura": 40, "comprimento": 40}'),
  ('peso_max_kg', '25'),
  ('tara_kg', '0'),
  ('fator_aproveitamento_api', '0.85'),
  ('fator_aproveitamento_master', '0.90'),
  ('fator_cubagem_rodoviario', '300'),
  ('fator_cubagem_aereo', '167')
on conflict (chave) do nothing;

-- 4) Histórico de despachos reais (calibração) ---------------------------
create table if not exists public.despachos_historico (
  id bigserial primary key,
  data date not null default current_date,
  referencia_pedido text,
  caixa_larg_cm numeric not null check (caixa_larg_cm > 0),
  caixa_alt_cm numeric not null check (caixa_alt_cm > 0),
  caixa_comp_cm numeric not null check (caixa_comp_cm > 0),
  ocupacao_pct numeric not null default 100 check (ocupacao_pct > 0 and ocupacao_pct <= 100),
  peso_real_kg numeric not null check (peso_real_kg > 0),
  status text not null default 'pendente' check (status in ('pendente', 'validado', 'descartado')),
  observacao text,
  estimativa jsonb,                          -- cálculo do modelo no momento do registro (estimado x real)
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  validado_por uuid,
  validado_em timestamptz
);
create table if not exists public.despachos_historico_itens (
  id bigserial primary key,
  despacho_id bigint not null references public.despachos_historico (id) on delete cascade,
  codigo_amigavel text not null,
  codigo_composto text,
  qtd integer not null check (qtd > 0)
);
create index if not exists despachos_historico_itens_despacho_idx on public.despachos_historico_itens (despacho_id);
create index if not exists despachos_historico_itens_codigo_idx on public.despachos_historico_itens (codigo_amigavel);

-- 5) RLS: só a equipe interna --------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['xbz_caixa_master', 'medidas_override', 'calc_config',
                           'despachos_historico', 'despachos_historico_itens'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "equipe all" on public.%I', t);
    execute format(
      'create policy "equipe all" on public.%I for all to authenticated '
      'using ((select public.is_admin_user())) with check ((select public.is_admin_user()))', t);
  end loop;
end $$;

-- 6) Importação da planilha master (substitui tudo numa transação) --------
-- A página lê a planilha no navegador, classifica cada linha e manda o
-- resultado aqui. Rodar de novo com a planilha atualizada é seguro.
create or replace function public.importar_caixa_master(linhas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if not public.is_admin_user() then
    raise exception 'sem permissão';
  end if;
  delete from public.xbz_caixa_master where true;
  insert into public.xbz_caixa_master
    (codigo_xbz, referencia, codigo_composto, descricao, qtd_por_caixa,
     largura_cm, altura_cm, comprimento_cm, status_revisao, motivo_revisao, importado_por)
  select l->>'codigo_xbz', l->>'referencia', l->>'codigo_composto', l->>'descricao',
         nullif(l->>'qtd_por_caixa', '')::integer,
         nullif(l->>'largura_cm', '')::numeric, nullif(l->>'altura_cm', '')::numeric,
         nullif(l->>'comprimento_cm', '')::numeric,
         coalesce(l->>'status_revisao', 'ok'), l->>'motivo_revisao', auth.uid()
  from jsonb_array_elements(linhas) l;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.importar_caixa_master(jsonb) from public, anon;
grant execute on function public.importar_caixa_master(jsonb) to authenticated;
