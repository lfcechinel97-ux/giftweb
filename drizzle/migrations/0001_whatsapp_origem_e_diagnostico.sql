alter table public.comercial_conversas
  add column if not exists primeira_mensagem_cliente text,
  add column if not exists primeira_mensagem_em timestamptz,
  add column if not exists primeira_mensagem_bruto jsonb,
  add column if not exists origem_detectada text,
  add column if not exists tempo_primeira_resposta_seg integer,
  add column if not exists tempo_mediano_resposta_seg integer,
  add column if not exists cliente_sem_resposta boolean;

create index if not exists comercial_conversas_iniciada_idx
  on public.comercial_conversas (iniciada_em desc nulls last);

create table if not exists public.comercial_origens_regras (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  padrao text not null,
  origem text not null check (origem in ('google', 'meta', 'organico', 'indicacao', 'outro')),
  campanha text
);

create table if not exists public.comercial_diagnosticos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  periodo_inicio date,
  periodo_fim date,
  total_conversas integer,
  modelo text,
  conteudo jsonb not null
);

revoke all on public.comercial_origens_regras from anon;
revoke all on public.comercial_diagnosticos from anon;
grant select, insert, update, delete on public.comercial_origens_regras to authenticated;
grant select on public.comercial_diagnosticos to authenticated;
grant all on public.comercial_origens_regras to service_role;
grant all on public.comercial_diagnosticos to service_role;

alter table public.comercial_origens_regras enable row level security;
alter table public.comercial_diagnosticos enable row level security;

drop policy if exists "admin gerencia regras de origem" on public.comercial_origens_regras;
create policy "admin gerencia regras de origem" on public.comercial_origens_regras
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admin le diagnosticos do comercial" on public.comercial_diagnosticos;
create policy "admin le diagnosticos do comercial" on public.comercial_diagnosticos
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

alter table public.comercial_analises
  add column if not exists nota_sdr numeric check (nota_sdr between 0 and 10),
  add column if not exists sdr jsonb;

create table if not exists public.comercial_configuracoes (
  chave text primary key,
  valor text not null default '',
  atualizado_em timestamptz not null default now()
);

revoke all on public.comercial_configuracoes from anon;
grant select, insert, update, delete on public.comercial_configuracoes to authenticated;
grant all on public.comercial_configuracoes to service_role;

alter table public.comercial_configuracoes enable row level security;

drop policy if exists "admin gerencia configuracoes do comercial" on public.comercial_configuracoes;
create policy "admin gerencia configuracoes do comercial" on public.comercial_configuracoes
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));