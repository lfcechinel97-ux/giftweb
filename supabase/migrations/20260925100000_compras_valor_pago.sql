-- =====================================================================
-- GIFT WEB - Valor pago em cada compra (pagina Compras). SO ADMIN:
-- tabela separada com RLS admin, para a Producao nunca receber o valor
-- (vw_pcp e sistema_producao_itens sao legiveis por ela).
-- =====================================================================
create table if not exists public.sistema_compras_valores (
  producao_item_id uuid primary key references public.sistema_producao_itens(id) on delete cascade,
  valor numeric(12,2) not null check (valor >= 0),
  atualizado_em timestamptz not null default now()
);

alter table public.sistema_compras_valores enable row level security;

drop policy if exists "somente admin" on public.sistema_compras_valores;
create policy "somente admin" on public.sistema_compras_valores
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

revoke all on public.sistema_compras_valores from anon;
grant select, insert, update, delete on public.sistema_compras_valores to authenticated;
