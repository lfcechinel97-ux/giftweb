-- =====================================================================
-- GIFT WEB - Análise das conversas do comercial (Datacrazy + IA).
--   comercial_conversas -> cópia das conversas do Datacrazy (cabeçalho +
--                          transcrição já montada) para não depender da API
--                          a cada leitura da tela.
--   comercial_analises  -> resultado da IA por conversa: nota, resumo,
--                          pontos fortes, melhorias, objeções (com como
--                          quebrar), oportunidades perdidas e próximo passo.
-- Quem grava é a edge function analisar-conversas-comercial via service
-- role; só admin lê (são conversas com clientes e avaliação do vendedor).
-- =====================================================================

create table if not exists public.comercial_conversas (
  id text primary key,                       -- id da conversa no Datacrazy
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  iniciada_em timestamptz,
  ultima_mensagem_em timestamptz,
  contato_nome text,
  contato_telefone text,
  atendente text,
  canal text,
  status text,
  total_mensagens integer not null default 0,
  transcricao text,
  -- Hash da transcrição analisada: só reanalisa se a conversa mudou.
  transcricao_hash text,
  bruto jsonb
);

create index if not exists comercial_conversas_ultima_idx
  on public.comercial_conversas (ultima_mensagem_em desc nulls last);

create table if not exists public.comercial_analises (
  id uuid primary key default gen_random_uuid(),
  conversa_id text not null references public.comercial_conversas(id) on delete cascade,
  criado_em timestamptz not null default now(),
  transcricao_hash text,
  modelo text not null,
  nota numeric check (nota between 0 and 10),
  resultado text,                            -- venda | em_andamento | perdida | sem_interesse | indefinido
  etapa_funil text,
  resumo text,
  pontos_fortes jsonb not null default '[]'::jsonb,
  melhorias jsonb not null default '[]'::jsonb,
  objecoes jsonb not null default '[]'::jsonb,
  oportunidades_perdidas jsonb not null default '[]'::jsonb,
  proximo_passo text,
  tokens_entrada integer,
  tokens_saida integer,
  bruto jsonb
);

create index if not exists comercial_analises_conversa_idx
  on public.comercial_analises (conversa_id, criado_em desc);

alter table public.comercial_conversas enable row level security;
alter table public.comercial_analises enable row level security;

drop policy if exists "admin le conversas do comercial" on public.comercial_conversas;
create policy "admin le conversas do comercial" on public.comercial_conversas
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admin le analises do comercial" on public.comercial_analises;
create policy "admin le analises do comercial" on public.comercial_analises
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

revoke all on public.comercial_conversas from anon;
revoke all on public.comercial_analises from anon;
grant select on public.comercial_conversas to authenticated;
grant select on public.comercial_analises to authenticated;
