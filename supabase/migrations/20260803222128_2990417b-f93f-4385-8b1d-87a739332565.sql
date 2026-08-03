create table if not exists public.top10_xbz_ajustes (
  codigo_prefixo text primary key,
  ativo boolean not null default true,
  ordem_override int,
  updated_at timestamptz not null default now()
);

grant select on public.top10_xbz_ajustes to anon;
grant select, insert, update, delete on public.top10_xbz_ajustes to authenticated;
grant all on public.top10_xbz_ajustes to service_role;

alter table public.top10_xbz_ajustes enable row level security;

create policy "Public read top10 ajustes" on public.top10_xbz_ajustes for select using (true);
create policy "Admins insert top10 ajustes" on public.top10_xbz_ajustes for insert to authenticated with check (is_admin_user());
create policy "Admins update top10 ajustes" on public.top10_xbz_ajustes for update to authenticated using (is_admin_user()) with check (is_admin_user());
create policy "Admins delete top10 ajustes" on public.top10_xbz_ajustes for delete to authenticated using (is_admin_user());