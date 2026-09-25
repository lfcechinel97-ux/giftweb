-- =====================================================================
-- GIFT WEB - Pedidos de compra (pagina Compras). Cada "COMPRADO" gera um
-- pedido de compra com as linhas compradas. Quantidades e produtos ficam
-- visiveis para admin e producao; PRECO fica em tabela separada, so admin.
-- =====================================================================
create table if not exists public.sistema_compras (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  fornecedor text not null,
  observacao text,
  criado_por_nome text,
  criado_em timestamptz not null default now()
);

create table if not exists public.sistema_compras_itens (
  id uuid primary key default gen_random_uuid(),
  compra_id uuid not null references public.sistema_compras(id) on delete cascade,
  producao_item_id uuid references public.sistema_producao_itens(id) on delete set null,
  pedido_numero text,
  cliente text,
  produto_nome text not null,
  quantidade numeric not null check (quantidade >= 0),
  ordem int not null default 0
);
create index if not exists idx_compras_itens_compra on public.sistema_compras_itens (compra_id, ordem);

create table if not exists public.sistema_compras_precos (
  compra_item_id uuid primary key references public.sistema_compras_itens(id) on delete cascade,
  valor_unitario numeric(12,4) not null check (valor_unitario >= 0)
);

alter table public.sistema_compras enable row level security;
alter table public.sistema_compras_itens enable row level security;
alter table public.sistema_compras_precos enable row level security;

drop policy if exists "admin e producao" on public.sistema_compras;
create policy "admin e producao" on public.sistema_compras for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'producao'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'producao'));

drop policy if exists "admin e producao" on public.sistema_compras_itens;
create policy "admin e producao" on public.sistema_compras_itens for all to authenticated
  using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'producao'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'producao'));

drop policy if exists "somente admin" on public.sistema_compras_precos;
create policy "somente admin" on public.sistema_compras_precos for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

revoke all on public.sistema_compras, public.sistema_compras_itens, public.sistema_compras_precos from anon;
grant select, insert, update, delete on public.sistema_compras, public.sistema_compras_itens, public.sistema_compras_precos to authenticated;
