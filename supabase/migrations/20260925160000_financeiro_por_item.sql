-- Custo UNITARIO por produto do pedido (so admin). O custo do produto e a
-- personalizacao valem por unidade; so o frete e do pedido inteiro.
create table if not exists public.sistema_item_financeiro (
  pedido_id uuid not null references public.sistema_pedidos(id) on delete cascade,
  item_id text not null,                       -- itens[].id do pedido
  custo_unitario numeric(12,4),                -- null = compras / custo do catalogo
  custo_personalizacao_unit numeric(12,4) not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (pedido_id, item_id)
);

alter table public.sistema_item_financeiro enable row level security;
drop policy if exists "somente admin" on public.sistema_item_financeiro;
create policy "somente admin" on public.sistema_item_financeiro for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
revoke all on public.sistema_item_financeiro from anon;
grant select, insert, update, delete on public.sistema_item_financeiro to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.sistema_item_financeiro;
exception when others then null;
end $$;
