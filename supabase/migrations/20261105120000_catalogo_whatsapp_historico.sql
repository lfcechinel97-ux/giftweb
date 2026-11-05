-- =====================================================================
-- GIFT WEB - Histórico das gerações do /catalogo-whatsapp.
--
-- Cada clique em "Gerar catálogo" que encontra produtos grava uma linha
-- com data/hora, quem gerou, o título e os códigos usados.
--
-- Acesso: qualquer usuário do painel (linha em admin_users, mesma regra
-- do AdminGuard da página) lê o histórico de todos e grava o seu.
--
-- Idempotente: pode rodar de novo no SQL Editor sem erro.
-- =====================================================================

create table if not exists public.catalogo_whatsapp_historico (
  id                 uuid primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  user_id            uuid default auth.uid() references auth.users(id) on delete set null,
  usuario            text,
  titulo             text not null default '',
  codigos            text[] not null default '{}',
  nao_encontrados    text[] not null default '{}',
  paginas            integer not null default 0
);

create index if not exists catalogo_whatsapp_historico_created_at_idx
  on public.catalogo_whatsapp_historico (created_at desc);

alter table public.catalogo_whatsapp_historico enable row level security;

drop policy if exists "catalogo_wa_hist_select" on public.catalogo_whatsapp_historico;
create policy "catalogo_wa_hist_select" on public.catalogo_whatsapp_historico
  for select to authenticated
  using (exists (select 1 from public.admin_users a where a.id = auth.uid()));

drop policy if exists "catalogo_wa_hist_insert" on public.catalogo_whatsapp_historico;
create policy "catalogo_wa_hist_insert" on public.catalogo_whatsapp_historico
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.admin_users a where a.id = auth.uid())
  );

drop policy if exists "catalogo_wa_hist_delete" on public.catalogo_whatsapp_historico;
create policy "catalogo_wa_hist_delete" on public.catalogo_whatsapp_historico
  for delete to authenticated
  using (public.is_gestor(auth.uid()));

grant select, insert, delete on public.catalogo_whatsapp_historico to authenticated;
